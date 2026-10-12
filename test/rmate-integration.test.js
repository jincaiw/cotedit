import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const menuState = readFileSync(new URL('../electron/menu-state.cjs', import.meta.url), 'utf8');
const server = readFileSync(new URL('../electron/rmate-server.cjs', import.meta.url), 'utf8');

test('remote editing is opt-in, loopback-only, and follows the upstream port and file-size bounds', () => {
  assert.match(main, /remoteEditingSettings = \{ enabled: false, port: DEFAULT_RMATE_PORT \}/);
  assert.match(main, /new RMateServer\(\{ applicationName: 'CotEdit' \}\)/);
  assert.match(server, /listener\.listen\(port, '127\.0\.0\.1'\)/);
  assert.match(server, /DEFAULT_RMATE_PORT = 52698/);
  assert.match(server, /MAX_RMATE_FILE_BYTES = 100 \* 1024 \* 1024/);
  assert.match(main, /port < 1 \|\| port > 65535/);
  assert.match(main, /remoteEditingServer\.stopAccepting\(\)/);
});

test('integration dialog documents SSH forwarding and exposes an accessible disabled-by-default toggle', () => {
  assert.match(html, /<dialog id="remote-editing-dialog"[^>]*aria-labelledby="remote-editing-title"/);
  assert.match(html, /<label class="page-setting-row"><span>接受 rmate 远程编辑连接<\/span><input id="remote-editing-enabled" type="checkbox"><\/label>/);
  assert.match(html, /id="remote-editing-port" type="number" min="1" max="65535"/);
  assert.match(html, /id="remote-editing-ssh-command"/);
  assert.match(html, /id="remote-editing-client-command"/);
  assert.match(html, /服务仅绑定 127\.0\.0\.1/);
  assert.match(renderer, /function showRemoteEditingDialog\(\)[\s\S]*?getRemoteEditingSettings\(\)[\s\S]*?showModal\(\)/);
});

test('native menu and preload expose only bounded settings, save, close, and remote-path operations', () => {
  assert.match(main, /外部集成设置…'[\s\S]*?menu:integration-settings/);
  assert.match(renderer, /'menu:integration-settings': showRemoteEditingDialog/);
  assert.match(preload, /getRemoteEditingSettings: \(\) => ipcRenderer\.invoke\('remote:get-settings'\)/);
  assert.match(preload, /saveRemoteDocument: \(payload\) => ipcRenderer\.invoke\('remote:save', payload\)/);
  assert.match(preload, /closeRemoteDocument: \(sessionId\) => ipcRenderer\.invoke\('remote:close', sessionId\)/);
  assert.match(main, /ipcMain\.handle\('remote:save'[\s\S]*?encodeText\(text, encoding, payload\.bom === true\)[\s\S]*?remoteEditingServer\.save/);
});

test('remote saves use the live session; disconnected or explicit Save As becomes a local file', () => {
  assert.match(renderer, /if \(!saveAs && activeDoc\.remoteSessionId && activeDoc\.remoteConnected\)[\s\S]*?saveRemoteDocument[\s\S]*?else \{[\s\S]*?saveFile/);
  assert.match(renderer, /if \(activeDoc\.remoteSessionId\) \{[\s\S]*?closeRemoteDocument[\s\S]*?activeDoc\.remoteSessionId = null/);
  assert.match(renderer, /function handleRemoteDisconnect\([\s\S]*?仍可编辑/);
  assert.match(renderer, /function syncWindowTitle\(\)[\s\S]*?远程 ·/);
});

test('remote file paths can be copied verbatim but are never revealed as local files', () => {
  assert.match(renderer, /hasPath: Boolean\(activeDoc\?\.path\)[\s\S]*?hasRemotePath: Boolean\(activeDoc\?\.remoteSessionId/);
  assert.match(menuState, /'menu-reveal-file': \{ enabled: hasDocument && payload\.hasPath === true \}/);
  assert.match(menuState, /'menu-copy-path': \{ enabled: hasDocument && \(payload\.hasPath === true \|\| payload\.hasRemotePath === true\) \}/);
  assert.match(main, /document:copy-remote-path[\s\S]*?clipboard\.writeText\(safeText\(remotePath, 4096\)\)/);
});
