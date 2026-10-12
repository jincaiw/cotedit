'use strict';

const net = require('node:net');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { TextDecoder } = require('node:util');

const DEFAULT_RMATE_PORT = 52698;
const MAX_RMATE_FILE_BYTES = 100 * 1024 * 1024;
const MAX_RMATE_HEADER_BYTES = 64 * 1024;
const MAX_RMATE_CONNECTIONS = 64;
const MAX_RMATE_FILES_PER_CONNECTION = 64;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

class RMateProtocolError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'RMateProtocolError';
    this.code = code;
  }
}

class RMateParser {
  constructor({ maxFileBytes = MAX_RMATE_FILE_BYTES, maxHeaderBytes = MAX_RMATE_HEADER_BYTES } = {}) {
    this.maxFileBytes = maxFileBytes;
    this.maxHeaderBytes = maxHeaderBytes;
    this.buffer = Buffer.alloc(0);
    this.message = null;
    this.remainingDataLength = 0;
    this.headerLength = 0;
    this.isFinished = false;
  }

  append(input) {
    const data = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
    if (this.isFinished) {
      if (data.length) throw new RMateProtocolError('invalidMessage');
      return [];
    }
    if (data.length) this.buffer = this.buffer.length ? Buffer.concat([this.buffer, data]) : data;
    const messages = [];

    while (this.buffer.length) {
      if (this.remainingDataLength > 0) {
        const count = Math.min(this.remainingDataLength, this.buffer.length);
        this.message.dataChunks.push(this.buffer.subarray(0, count));
        this.message.dataLength += count;
        this.buffer = this.buffer.subarray(count);
        this.remainingDataLength -= count;
        continue;
      }

      const newline = this.buffer.indexOf(0x0a);
      if (newline < 0) {
        if (this.buffer.length > this.maxHeaderBytes) throw new RMateProtocolError('headerTooLarge');
        break;
      }
      if (newline > this.maxHeaderBytes) throw new RMateProtocolError('headerTooLarge');

      let line;
      try {
        line = utf8Decoder.decode(this.buffer.subarray(0, newline));
      } catch {
        throw new RMateProtocolError('invalidMessage');
      }
      this.buffer = this.buffer.subarray(newline + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);

      if (!this.message) {
        if (!line) continue;
        if (line === '.') {
          if (this.buffer.length) throw new RMateProtocolError('invalidMessage');
          this.isFinished = true;
          break;
        }
        if (line !== 'open') throw new RMateProtocolError('invalidMessage');
        this.message = { command: line, headers: Object.create(null), dataChunks: [], dataLength: 0 };
        this.headerLength = 0;
        continue;
      }

      if (!line) {
        const current = this.message;
        messages.push({ command: current.command, headers: current.headers, data: Buffer.concat(current.dataChunks, current.dataLength) });
        this.message = null;
        this.headerLength = 0;
        continue;
      }

      this.headerLength += Buffer.byteLength(line, 'utf8');
      if (this.headerLength > this.maxHeaderBytes) throw new RMateProtocolError('headerTooLarge');
      const separator = line.indexOf(': ');
      if (separator <= 0) throw new RMateProtocolError('invalidMessage');
      const key = line.slice(0, separator);
      const value = line.slice(separator + 2);
      if (key === 'data') {
        if (!/^(0|[1-9]\d*)$/.test(value)) throw new RMateProtocolError('invalidMessage');
        const length = Number(value);
        if (!Number.isSafeInteger(length) || length > this.maxFileBytes - this.message.dataLength) {
          throw new RMateProtocolError('fileTooLarge');
        }
        this.remainingDataLength = length;
      } else {
        if (!key || /[\r\n\0]/.test(value)) throw new RMateProtocolError('invalidMessage');
        this.message.headers[key] = value;
      }
    }
    return messages;
  }
}

function encodeRMateMessage(command, headers = {}, data = Buffer.alloc(0)) {
  const chunks = [Buffer.from(`${command}\n`, 'utf8')];
  for (const key of Object.keys(headers).sort()) {
    const value = String(headers[key]);
    if (!/^[^:\r\n\0]+$/.test(key) || /[\r\n\0]/.test(value)) throw new RMateProtocolError('invalidMessage');
    chunks.push(Buffer.from(`${key}: ${value}\n`, 'utf8'));
  }
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  if (command === 'save') {
    chunks.push(Buffer.from(`data: ${bytes.length}\n`, 'utf8'), bytes);
  }
  chunks.push(Buffer.from('\n', 'utf8'));
  return Buffer.concat(chunks);
}

class RMateServer extends EventEmitter {
  constructor({ applicationName = 'CotEdit', maxFileBytes = MAX_RMATE_FILE_BYTES } = {}) {
    super();
    this.applicationName = String(applicationName).replace(/[\r\n\0]/g, '').slice(0, 100) || 'CotEdit';
    this.maxFileBytes = maxFileBytes;
    this.listener = null;
    this.port = null;
    this.connections = new Set();
    this.sessions = new Map();
    this.listeningError = null;
  }

  async listen(port = DEFAULT_RMATE_PORT) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('端口号必须在 1–65535 之间。');
    if (this.listener && this.port === port) return this.port;
    this.stopAccepting();

    const listener = net.createServer(socket => this.accept(socket));
    listener.maxConnections = MAX_RMATE_CONNECTIONS;
    this.listener = listener;
    this.listeningError = null;
    listener.on('error', error => {
      if (this.listener === listener) this.listener = null;
      this.listeningError = error;
      this.emitSafe('listenError', error);
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = error => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      listener.once('error', fail);
      listener.once('listening', () => {
        if (settled) return;
        settled = true;
        listener.removeListener('error', fail);
        const address = listener.address();
        this.port = address && typeof address === 'object' ? address.port : port;
        this.emitSafe('listening', { host: '127.0.0.1', port: this.port });
        resolve(this.port);
      });
      listener.listen(port, '127.0.0.1');
    }).catch(error => {
      if (this.listener === listener) this.listener = null;
      this.port = null;
      this.listeningError = error;
      this.emitSafe('listenError', error);
      throw error;
    });
    return this.port;
  }

  stopAccepting() {
    const listener = this.listener;
    this.listener = null;
    this.port = null;
    if (listener?.listening) listener.close();
  }

  async save(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session?.connected || !session.socket.writable) throw new Error('远程连接已断开。');
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
    if (bytes.length > this.maxFileBytes) throw new RMateProtocolError('fileTooLarge');
    const message = encodeRMateMessage('save', { token: session.token }, bytes);
    await new Promise((resolve, reject) => {
      session.socket.write(message, error => error ? reject(error) : resolve());
    }).catch(error => {
      session.socket.destroy();
      throw error;
    });
    if (!session.connected) throw new Error('远程连接已断开。');
    return true;
  }

  closeFile(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    session.connection.sessions.delete(sessionId);
    if (session.connected && session.socket.writable) {
      session.socket.write(encodeRMateMessage('close', { token: session.token }), error => {
        if (error) session.socket.destroy();
      });
    }
    return true;
  }

  close() {
    this.stopAccepting();
    for (const socket of this.connections) socket.destroy();
    this.connections.clear();
    this.sessions.clear();
  }

  accept(socket) {
    if (this.connections.size >= MAX_RMATE_CONNECTIONS) {
      socket.destroy();
      return;
    }
    socket.setNoDelay(true);
    const connection = { socket, parser: new RMateParser({ maxFileBytes: this.maxFileBytes }), sessions: new Set() };
    this.connections.add(socket);
    socket.once('close', () => this.disconnect(connection));
    socket.on('error', error => this.emitSafe('connectionError', error));
    socket.on('data', chunk => {
      try {
        for (const message of connection.parser.append(chunk)) this.open(connection, message);
      } catch (error) {
        this.emitSafe('protocolError', error);
        socket.destroy();
      }
    });
    socket.write(`${this.applicationName} rmate 1\n`, error => {
      if (error) socket.destroy();
    });
  }

  open(connection, message) {
    if (connection.sessions.size >= MAX_RMATE_FILES_PER_CONNECTION) throw new RMateProtocolError('tooManyFiles');
    const token = message.headers.token;
    if (!token || Buffer.byteLength(token, 'utf8') > 4096 || message.headers['data-on-save'] !== 'yes') {
      throw new RMateProtocolError('invalidMessage');
    }
    const id = randomUUID();
    const session = {
      id,
      token,
      socket: connection.socket,
      connection,
      connected: true,
      displayName: (message.headers['display-name'] || token).slice(0, 512),
      remotePath: (message.headers['real-path'] || token).slice(0, 4096),
      lineNumber: positiveInteger(message.headers.selection),
      fileType: typeof message.headers['file-type'] === 'string' ? message.headers['file-type'].slice(0, 256) : null
    };
    this.sessions.set(id, session);
    connection.sessions.add(id);
    this.emitSafe('open', { ...session, data: message.data });
  }

  disconnect(connection) {
    this.connections.delete(connection.socket);
    for (const id of connection.sessions) {
      const session = this.sessions.get(id);
      if (!session || !session.connected) continue;
      session.connected = false;
      this.emitSafe('disconnect', { id, displayName: session.displayName, remotePath: session.remotePath });
    }
    connection.sessions.clear();
  }

  emitSafe(event, value) {
    for (const listener of this.listeners(event)) {
      try { listener(value); } catch (error) { this.emit('handlerError', error); }
    }
  }
}

function positiveInteger(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,8}$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

module.exports = {
  DEFAULT_RMATE_PORT,
  MAX_RMATE_CONNECTIONS,
  MAX_RMATE_FILES_PER_CONNECTION,
  MAX_RMATE_FILE_BYTES,
  MAX_RMATE_HEADER_BYTES,
  RMateParser,
  RMateProtocolError,
  RMateServer,
  encodeRMateMessage
};
