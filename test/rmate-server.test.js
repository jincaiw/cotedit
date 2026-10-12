import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import rmate from '../electron/rmate-server.cjs';

const { DEFAULT_RMATE_PORT, MAX_RMATE_FILE_BYTES, RMateParser, RMateProtocolError, RMateServer, encodeRMateMessage } = rmate;

function clientOpen({ token = '/tmp/test.txt', displayName = 'test.txt', realPath = token, data = Buffer.alloc(0), selection = '1', terminate = true } = {}) {
  const headers = [`token: ${token}`, `display-name: ${displayName}`, `real-path: ${realPath}`, 'data-on-save: yes'];
  if (selection) headers.push(`selection: ${selection}`);
  headers.push(`data: ${data.length}`);
  return Buffer.concat([Buffer.from(`open\n${headers.join('\n')}\n`, 'utf8'), data, Buffer.from(`\n\n${terminate ? '.\n' : ''}`, 'utf8')]);
}

async function waitFor(predicate, label, timeout = 2500) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

test('parses fragmented and multiple rmate open messages with binary payloads', () => {
  const firstData = Buffer.from([0, 10, 13, 255, ...Buffer.from('日本語\n.\nopen\n')]);
  const wire = Buffer.concat([
    clientOpen({ token: '/tmp/first.txt', displayName: 'host:first.txt', realPath: '/srv/first.txt', data: firstData, selection: '12', terminate: false }),
    Buffer.from('open\ntoken: /tmp/empty\ndata-on-save: yes\ndata: 0\n\n.\n')
  ]);

  for (const chunkSize of [1, 2, 7, 64 * 1024]) {
    const parser = new RMateParser();
    const messages = [];
    for (let offset = 0; offset < wire.length; offset += chunkSize) {
      messages.push(...parser.append(wire.subarray(offset, Math.min(offset + chunkSize, wire.length))));
    }
    assert.equal(parser.isFinished, true);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].headers.token, '/tmp/first.txt');
    assert.equal(messages[0].headers['data-on-save'], 'yes');
    assert.deepEqual(messages[0].data, firstData);
    assert.equal(messages[1].data.length, 0);
  }
});

test('accepts sequential data blocks and UTF-8 CRLF headers', () => {
  const parser = new RMateParser();
  const messages = parser.append(Buffer.from('open\r\ntoken: /tmp/a\r\ndata: 3\r\nabcdata: 2\r\nde\r\n\n.\n'));
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].data, Buffer.from('abcde'));
});

test('rejects malformed commands, headers, lengths, incomplete termination, and post-terminator data', () => {
  for (const input of ['save\ntoken: x\n\n', 'open\nbroken\n\n', 'open\ndata: -1\n\n', 'open\ndata: nope\n\n', 'open\ntoken: bad\rvalue\n\n']) {
    const parser = new RMateParser();
    assert.throws(() => parser.append(Buffer.from(input)), RMateProtocolError, input);
  }
  const finished = new RMateParser();
  finished.append(Buffer.from('.\n'));
  assert.throws(() => finished.append(Buffer.from('unexpected')), error => error.code === 'invalidMessage');
});

test('bounds the header and cumulative payload to 64 KiB and 100 MiB', () => {
  const headerParser = new RMateParser();
  assert.throws(() => headerParser.append(Buffer.alloc(64 * 1024 + 1, 65)), error => error.code === 'headerTooLarge');

  const parser = new RMateParser({ maxFileBytes: 4 });
  assert.throws(() => parser.append(Buffer.from('open\ndata: 5\n')), error => error.code === 'fileTooLarge');
  assert.equal(MAX_RMATE_FILE_BYTES, 100 * 1024 * 1024);
});

test('encodes save payload length in bytes and validates outgoing header values', () => {
  const saved = encodeRMateMessage('save', { token: '/tmp/a' }, Buffer.from('あ\n'));
  assert.deepEqual(saved, Buffer.from('save\ntoken: /tmp/a\ndata: 4\nあ\n\n'));
  assert.deepEqual(encodeRMateMessage('close', { token: 'x' }), Buffer.from('close\ntoken: x\n\n'));
  assert.throws(() => encodeRMateMessage('close', { token: 'x\ny' }), error => error.code === 'invalidMessage');
  assert.equal(DEFAULT_RMATE_PORT, 52698);
});

test('RMate server listens on IPv4 loopback and opens, saves, closes, and tracks disconnects', { timeout: 8000 }, async t => {
  const server = new RMateServer();
  t.after(() => server.close());
  const port = await server.listen(0);
  assert.equal(server.listener.address().address, '127.0.0.1');
  assert.ok(port > 0);

  const socket = net.createConnection({ host: '127.0.0.1', port });
  t.after(() => socket.destroy());
  let incoming = Buffer.alloc(0);
  socket.on('data', chunk => { incoming = Buffer.concat([incoming, chunk]); });
  await once(socket, 'connect');
  await waitFor(() => incoming.includes(Buffer.from('CotEdit rmate 1\n')), 'server greeting');

  const opened = once(server, 'open');
  const source = Buffer.from('remote text\n', 'utf8');
  socket.write(clientOpen({ token: 'remote-token', displayName: 'remote.txt', realPath: '/srv/remote.txt', data: source, selection: '3' }));
  const [file] = await opened;
  assert.equal(file.displayName, 'remote.txt');
  assert.equal(file.remotePath, '/srv/remote.txt');
  assert.equal(file.lineNumber, 3);
  assert.deepEqual(file.data, source);

  const replacement = Buffer.from('saved ✓\n', 'utf8');
  await server.save(file.id, replacement);
  await waitFor(() => incoming.includes(encodeRMateMessage('save', { token: 'remote-token' }, replacement)), 'save message');
  assert.equal(server.closeFile(file.id), true);
  await waitFor(() => incoming.includes(encodeRMateMessage('close', { token: 'remote-token' })), 'close message');
  assert.equal(server.closeFile(file.id), false);
  socket.destroy();

  const disconnectedSocket = net.createConnection({ host: '127.0.0.1', port });
  t.after(() => disconnectedSocket.destroy());
  await once(disconnectedSocket, 'connect');
  const disconnectedOpen = once(server, 'open');
  disconnectedSocket.write(clientOpen({ token: 'disconnect-token', data: source }));
  const [disconnectedFile] = await disconnectedOpen;
  const disconnected = once(server, 'disconnect');
  disconnectedSocket.destroy();
  const [info] = await disconnected;
  assert.equal(info.id, disconnectedFile.id);
  assert.equal(server.sessions.get(disconnectedFile.id).connected, false);
  await assert.rejects(server.save(disconnectedFile.id, replacement), /断开/);
});

test('rejects invalid configured port values while keeping ephemeral port available to tests', async () => {
  const server = new RMateServer();
  await assert.rejects(server.listen(-1), RangeError);
  await assert.rejects(server.listen(65536), RangeError);
  server.close();
});
