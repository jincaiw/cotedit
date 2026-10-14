'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const projectRoot = path.resolve(__dirname, '..');
const applicationVersion = require('../package.json').version;
const electronExecutable = process.env.COTEDIT_ELECTRON_BIN || require('electron');
const applicationEntry = process.env.COTEDIT_APP_ENTRY || '.';
const cdpTimeoutMs = Math.max(1000, Number(process.env.COTEDIT_CDP_TIMEOUT_MS) || 8000);
const uiTimeoutMs = Math.max(60000, Number(process.env.COTEDIT_UI_TIMEOUT_MS) || 60000);

class DevToolsClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const callback = this.pending.get(message.id);
      if (!callback) return;
      this.pending.delete(message.id);
      clearTimeout(callback.timer);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const expression = method === 'Runtime.evaluate' && typeof params.expression === 'string'
          ? ` (${params.expression.replace(/\s+/g, ' ').slice(0, 180)})`
          : '';
        reject(new Error(`Timed out waiting for CDP method ${method}${expression} after ${cdpTimeoutMs}ms`));
      }, cdpTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result?.value;
  }

  async key(key, code, keyCode, modifiers = 0) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
  }

  async click(selector) {
    const point = await this.evaluate(`(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (!target) return null; target.scrollIntoView({ block: 'center', inline: 'nearest' }); const rect = target.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
    if (!point) throw new Error(`Cannot click missing target ${selector}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  }

  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('DevTools connection closed'));
    }
    this.pending.clear();
    this.socket.close();
  }
}

async function waitFor(predicate, label, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await delay(60);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function findAvailableLoopbackPort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

function rmateOpenFrame({ token, displayName, realPath, fileType, line, data }) {
  return Buffer.concat([
    Buffer.from(`open\ntoken: ${token}\ndisplay-name: ${displayName}\nreal-path: ${realPath}\nfile-type: ${fileType}\nselection: ${line}\ndata-on-save: yes\ndata: ${data.length}\n`, 'utf8'),
    data,
    Buffer.from('\n\n.\n', 'utf8')
  ]);
}

async function inspectAccessibleControls(client, label, expected = []) {
  if (!client.accessibilityEnabled) {
    await client.send('Accessibility.enable');
    client.accessibilityEnabled = true;
  }
  const { nodes = [] } = await client.send('Accessibility.getFullAXTree');
  const interactiveRoles = new Set(['button', 'checkbox', 'textbox', 'searchbox', 'combobox', 'tab', 'menuitem', 'radioButton', 'switch', 'dialog', 'slider', 'spinButton', 'spinbutton']);
  const controls = nodes
    .filter(node => !node.ignored && interactiveRoles.has(node.role?.value))
    .map(node => ({ role: node.role.value, name: node.name?.value || '' }));
  assert.deepEqual(controls.filter(control => !control.name), [], `${label} has no unnamed exposed interactive controls`);
  for (const item of expected) {
    assert.ok(controls.some(control => control.role === item.role && control.name === item.name), `${label} exposes ${item.role} “${item.name}”; available controls: ${JSON.stringify(controls)}`);
  }
  return controls;
}

function signalProcessTree(child, signal) {
  if (!child?.pid) return;
  try {
    process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

test('Electron renderer exposes a labelled tabpanel and maintains keyboard/focus behavior', { timeout: uiTimeoutMs }, async t => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'cotedit-ui-test-'));
  const child = spawn(electronExecutable, [
    applicationEntry, '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${userData}`
  ], { cwd: projectRoot, env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', COTEDIT_TEST_USER_DATA_DIR: userData }, stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32' });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-5000); });
  let client;
  let remoteSocket;

  t.after(async () => {
    remoteSocket?.destroy();
    client?.close();
    signalProcessTree(child, 'SIGTERM');
    await Promise.race([
      child.exitCode === null ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve(),
      delay(2500)
    ]);
    signalProcessTree(child, 'SIGKILL');
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(500)]);
    await rm(userData, { recursive: true, force: true });
  });

  let port;
  try {
    const portFile = path.join(userData, 'DevToolsActivePort');
    await waitFor(async () => {
      try {
        const value = (await readFile(portFile, 'utf8')).split('\n')[0];
        if (/^\d+$/.test(value)) { port = value; return true; }
      } catch {}
      if (child.exitCode !== null) throw new Error(`Electron exited with ${child.exitCode}: ${stderr}`);
      return false;
    }, 'Electron DevTools port', 30000);

    const targets = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const pages = (await response.json()).filter(target => target.type === 'page');
        return pages[0] || false;
      } catch { return false; }
    }, 'Electron page target');
    assert.ok(targets.webSocketDebuggerUrl, `Missing DevTools target URL: ${JSON.stringify(targets)}`);

    const socket = new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    client = new DevToolsClient(socket);
    await waitFor(async () => client.evaluate('document.readyState === "interactive" || document.readyState === "complete"'), 'renderer readiness');
    await waitFor(async () => client.evaluate('Boolean(document.querySelector("#welcome-new"))'), 'welcome screen');
    await waitFor(async () => client.evaluate(`document.querySelector("#app-version")?.textContent === ${JSON.stringify(applicationVersion)}`), 'application module and event handlers');

    await inspectAccessibleControls(client, 'initial window', [
      { role: 'textbox', name: '文本编辑器：未命名.txt' },
      { role: 'tab', name: '未命名.txt' },
      { role: 'combobox', name: '文本编码' }
    ]);
    const syntaxLabels = JSON.parse(await client.evaluate(`JSON.stringify({ locale: navigator.language, labels: Array.from(document.querySelectorAll('#language-select option'), option => option.textContent) })`));
    const syntaxCollator = new Intl.Collator(syntaxLabels.locale, { usage: 'sort', numeric: true, sensitivity: 'base' });
    assert.deepEqual(syntaxLabels.labels, [...syntaxLabels.labels].sort((a, b) => syntaxCollator.compare(a, b)), 'the full syntax list should use locale-aware natural ordering');

    const systemColors = JSON.parse(await client.evaluate(`JSON.stringify((() => { const root = document.documentElement; const original = root.dataset.theme; root.dataset.theme = 'light'; const light = getComputedStyle(root).colorScheme; root.dataset.theme = 'dark'; const dark = getComputedStyle(root).colorScheme; root.dataset.theme = original; return {light, dark, selection: CSS.supports('color', 'Highlight'), text: CSS.supports('color', 'CanvasText'), accent: CSS.supports('color', 'AccentColor')}; })())`));
    assert.deepEqual(systemColors, { light: 'light', dark: 'dark', selection: true, text: true, accent: true }, 'system color roles should be usable while the app switches explicit color schemes');

    await client.evaluate('document.querySelector("#encoding-select").focus(); true');
    await client.key('Tab', 'Tab', 9);
    const statusFocus = JSON.parse(await client.evaluate(`JSON.stringify((() => { const element = document.activeElement; const style = getComputedStyle(element); return {id: element.id, focusVisible: element.matches(':focus-visible'), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth}; })())`));
    assert.deepEqual(statusFocus, { id: 'eol-select', focusVisible: true, outlineStyle: 'solid', outlineWidth: '2px' }, 'keyboard focus must remain visible when moving between status-bar selectors');
    await client.evaluate('document.activeElement.blur(); true');

    try {
      for (const width of [860, 940, 1100, 1280]) {
        await client.send('Emulation.setDeviceMetricsOverride', { width, height: 820, deviceScaleFactor: 1, mobile: false });
        await waitFor(async () => client.evaluate(`window.innerWidth === ${width}`), `${width}px viewport`);
        const toolbarLayout = JSON.parse(await client.evaluate(`JSON.stringify((() => {
          const toolbar = document.querySelector('.document-toolbar');
          const identity = document.querySelector('.document-identity');
          const tools = document.querySelector('.document-tools');
          const rect = element => { const box = element.getBoundingClientRect(); return {left: box.left, right: box.right, width: box.width}; };
          return {viewport: window.innerWidth, toolbar: rect(toolbar), identity: rect(identity), tools: {...rect(tools), clientWidth: tools.clientWidth, scrollWidth: tools.scrollWidth}, buttons: [...tools.querySelectorAll('.tool-button')].filter(button => !button.hidden && getComputedStyle(button).display !== 'none').map(rect)};
        })())`));
        assert.equal(toolbarLayout.viewport, width);
        assert.ok(toolbarLayout.identity.right <= toolbarLayout.tools.left + 1, `${width}px toolbar identity must not overlap its controls`);
        assert.ok(toolbarLayout.tools.right <= toolbarLayout.toolbar.right + 1, `${width}px toolbar controls must stay inside the toolbar`);
        assert.ok(toolbarLayout.tools.scrollWidth <= toolbarLayout.tools.clientWidth + 1, `${width}px toolbar controls must not overflow their container`);
        assert.equal(toolbarLayout.buttons.length, 8, `${width}px layout keeps all default toolbar actions available`);
        assert.ok(toolbarLayout.buttons.every(button => button.left >= toolbarLayout.toolbar.left - 1 && button.right <= toolbarLayout.toolbar.right + 1), `${width}px toolbar buttons must remain within the toolbar bounds`);
      }
    } finally {
      await client.send('Emulation.clearDeviceMetricsOverride');
    }

    const viewPreferenceDefaults = JSON.parse(await client.evaluate(`JSON.stringify({wrap:document.querySelector('#editor .cm-content')?.classList.contains('cm-lineWrapping'),currentLineHighlight:document.querySelector('#highlight-current-line-setting')?.checked,selectedTextMatches:document.querySelector('#selected-text-matches-setting')?.checked,tabbar:document.querySelector('#tabbar-setting')?.checked,toolbar:document.querySelector('#toolbar-setting')?.checked,verticalSplit:document.querySelector('#split-orientation-setting')?.checked,writingDirection:document.querySelector('#writing-direction-setting')?.value,tabbarVisible:!document.querySelector('.tabbar')?.classList.contains('hidden'),toolbarVisible:!document.querySelector('.document-toolbar')?.classList.contains('hidden')})`));
    assert.deepEqual(viewPreferenceDefaults, { wrap: true, currentLineHighlight: false, selectedTextMatches: true, tabbar: true, toolbar: true, verticalSplit: false, writingDirection: 'ltr', tabbarVisible: true, toolbarVisible: true });
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#settings-popover").getAttribute("aria-hidden") === "false"'), 'view settings open');
    await inspectAccessibleControls(client, 'settings popover', [
      { role: 'dialog', name: '编辑器设置' },
      { role: 'checkbox', name: '自动换行' },
      { role: 'checkbox', name: '使用字体连字' },
      { role: 'button', name: '选择字体…' },
      { role: 'combobox', name: '当前语法字体类型' },
      { role: 'checkbox', name: '全局默认：Tab 展开为空格' },
      { role: 'combobox', name: '当前语法 Tab 输入' },
      { role: 'combobox', name: '当前语法双空格插入句点' },
      { role: 'combobox', name: '新文稿默认书写方向' }
    ]);
    assert.equal(await client.evaluate('document.querySelector("#ligatures-setting").checked'), true, 'ligatures preserve the current default rendering');
    assert.equal(await client.evaluate('document.querySelector("#font-type-language-setting").value'), 'mode-default', 'plain text follows its general Mode font type');
    await client.evaluate(`(() => { const select = document.querySelector('#font-type-language-setting'); select.value = 'monospaced'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).fontTypeByLanguage.plaintext === "monospaced" && document.documentElement.dataset.fontType === "monospaced"'), 'font type override applies to the current syntax');
    await client.evaluate(`(() => { const select = document.querySelector('#font-type-language-setting'); select.value = 'mode-default'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('!JSON.parse(localStorage.getItem("cotedit.settings.v1")).fontTypeByLanguage.plaintext && document.documentElement.dataset.fontType === "standard"'), 'font type can return to the current syntax Mode default');
    assert.equal(await client.evaluate('document.querySelector("#tab-expansion-language-setting").value'), 'mode-default', 'Tab expansion follows the global setting by default');
    assert.equal(await client.evaluate('document.querySelector("#auto-expand-tab-setting").checked'), false, 'the global Tab expansion default is off');
    await client.evaluate(`(() => { const input = document.querySelector('#auto-expand-tab-setting'); input.checked = true; input.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).autoExpandTab === true'), 'global Tab expansion preference is saved');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'x' });
    await client.key('Tab', 'Tab', 9);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), 'x   ', 'the inherited global preference expands Tab');
    await client.key('Backspace', 'Backspace', 8);
    await client.key('Backspace', 'Backspace', 8);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), '', 'the inherited-global input check restores an empty document');
    await client.evaluate(`(() => { const input = document.querySelector('#auto-expand-tab-setting'); input.checked = false; input.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).autoExpandTab === false'), 'global Tab expansion preference returns to off');
    await client.evaluate(`(() => { const select = document.querySelector('#tab-expansion-language-setting'); select.value = 'on'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).autoExpandTabByLanguage.plaintext === true'), 'Tab expansion preference is saved per syntax');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'x' });
    await client.key('Tab', 'Tab', 9);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), 'x   ', 'the syntax override expands Tab to the next soft-tab stop');
    await client.key('Backspace', 'Backspace', 8);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), 'x', 'soft Backspace removes the inserted spaces as one unit');
    await client.key('Backspace', 'Backspace', 8);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), '', 'the test restores an empty document');
    await client.evaluate(`(() => { const select = document.querySelector('#tab-expansion-language-setting'); select.value = 'off'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'x' });
    await client.key('Tab', 'Tab', 9);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), 'x\t', 'the syntax override inserts a literal Tab');
    await client.key('Backspace', 'Backspace', 8);
    await client.key('Backspace', 'Backspace', 8);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), '', 'literal Tab and its prefix are removable');
    await client.evaluate(`(() => { const select = document.querySelector('#tab-expansion-language-setting'); select.value = 'mode-default'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => !await client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).autoExpandTabByLanguage.plaintext'), 'Tab expansion preference returns to the global fallback');
    assert.equal(await client.evaluate('document.querySelector("#automatic-period-language-setting").value'), 'mode-default', 'double-space period substitution follows the disabled Mode default');
    await client.evaluate(`(() => { const select = document.querySelector('#automatic-period-language-setting'); select.value = 'on'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).automaticPeriodSubstitutionByLanguage.plaintext === true'), 'double-space period preference is saved per syntax');
    await client.evaluate(`(() => { const select = document.querySelector('#automatic-period-language-setting'); select.value = 'mode-default'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('!JSON.parse(localStorage.getItem("cotedit.settings.v1")).automaticPeriodSubstitutionByLanguage.plaintext'), 'double-space period preference returns to the Mode default');
    await client.evaluate('document.querySelector("#font-family-open").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#font-picker-dialog").open && document.activeElement.id === "font-family-input"'), 'Show Fonts opens with family search focus');
    await inspectAccessibleControls(client, 'Show Fonts dialog', [
      { role: 'dialog', name: '显示字体' },
      { role: 'combobox', name: '字体系列' },
      { role: 'button', name: '应用' },
      { role: 'button', name: '使用字体类型默认值' }
    ]);
    await client.evaluate(`(() => { const input = document.querySelector('#font-family-input'); input.value = 'Noto Sans SC'; input.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    assert.equal(await client.evaluate('document.querySelector("#font-picker-apply").disabled'), false, 'a valid family can be applied');
    await client.evaluate('document.querySelector("#font-picker-apply").click(); true');
    const fontApplyState = JSON.parse(await client.evaluate(`JSON.stringify({stored:JSON.parse(localStorage.getItem('cotedit.settings.v1')).fontFamily, editor:getComputedStyle(document.querySelector('#editor .cm-scroller')).fontFamily, root:getComputedStyle(document.documentElement).getPropertyValue('--editor-font-family')})`));
    assert.equal(fontApplyState.stored, 'Noto Sans SC', `the custom font preference is saved: ${JSON.stringify(fontApplyState)}`);
    assert.ok(fontApplyState.editor.includes('Noto Sans SC'), `the custom font reaches CodeMirror: ${JSON.stringify(fontApplyState)}`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).fontFamily === "Noto Sans SC" && getComputedStyle(document.querySelector("#editor .cm-scroller")).fontFamily.includes("Noto Sans SC")'), 'custom font family persists and applies to the editor');
    await client.evaluate('document.querySelector("#ligatures-setting").click(); true');
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).ligatures === false && getComputedStyle(document.querySelector("#editor .cm-content")).fontVariantLigatures === "none"'), 'disabling ligatures persists and applies to CodeMirror content');
    await client.evaluate('document.querySelector("#ligatures-setting").click(); true');
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).ligatures === true && getComputedStyle(document.querySelector("#editor .cm-content")).fontVariantLigatures === "normal"'), 're-enabling ligatures restores normal rendering');
    await client.evaluate('document.querySelector("#remote-editing-open").focus(); document.querySelector("#remote-editing-open").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#remote-editing-dialog").open && document.querySelector("#remote-editing-port").value === "52698"'), 'RMate integration settings open with default port');
    await inspectAccessibleControls(client, 'remote integration settings', [
      { role: 'dialog', name: '外部集成' },
      { role: 'checkbox', name: '接受 rmate 远程编辑连接' },
      { role: 'spinbutton', name: '本机监听端口' },
      { role: 'button', name: '应用' }
    ]);
    const remoteDefaults = JSON.parse(await client.evaluate(`JSON.stringify({enabled:document.querySelector('#remote-editing-enabled').checked,port:document.querySelector('#remote-editing-port').value,status:document.querySelector('#remote-editing-status').textContent,ssh:document.querySelector('#remote-editing-ssh-command').textContent,client:document.querySelector('#remote-editing-client-command').textContent})`));
    assert.deepEqual(remoteDefaults, { enabled: false, port: '52698', status: '远程编辑默认关闭；启用后只绑定本机回环地址，不会在局域网或公网开放端口。', ssh: 'ssh -R 52698:127.0.0.1:52698 用户名@远端主机', client: 'rmate -p 52698 文件名' });
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('!document.querySelector("#remote-editing-dialog").open && document.activeElement.id === "settings-toggle"'), 'RMate settings Escape restores focus to the settings control');
    assert.equal(await client.evaluate('document.querySelector("#syntax-mapping-conflicts-settings").disabled'), true, 'the mapping-conflict action is disabled when there are no duplicates');
    await client.evaluate(`(() => {
      const syntaxes = [
        {format:'cotsyntax', id:'cot-syntax-smoke-alpha', name:'Alpha Smoke', extensions:['txt'], filenames:['Makefile'], interpreters:['node'], rules:[]},
        {format:'cotsyntax', id:'cot-syntax-smoke-zulu', name:'Zulu Smoke', extensions:['txt'], filenames:['makefile'], interpreters:['node'], rules:[]}
      ];
      const value = JSON.stringify(syntaxes);
      localStorage.setItem('cotedit.cot-syntax.v1', value);
      window.dispatchEvent(new StorageEvent('storage', {key:'cotedit.cot-syntax.v1', newValue:value}));
      return true;
    })()`);
    await waitFor(async () => client.evaluate('!document.querySelector("#syntax-mapping-conflicts-settings").disabled'), 'duplicated file mappings enable the conflict report');
    await client.evaluate('document.querySelector("#syntax-mapping-conflicts-settings").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#syntax-mapping-conflicts-dialog").open && document.querySelectorAll("#syntax-mapping-conflict-tables table").length === 3'), 'extension, filename and interpreter conflict tables');
    await inspectAccessibleControls(client, 'syntax mapping conflict dialog', [
      { role: 'dialog', name: '语法文件映射冲突' },
      { role: 'button', name: '关闭' }
    ]);
    const mappingReport = await client.evaluate('document.querySelector("#syntax-mapping-conflict-tables").innerText');
    for (const expected of ['文件扩展名', '.txt', 'Alpha Smoke', 'Zulu Smoke', '纯文本', '文件名', 'makefile', '解释器', 'node']) assert.ok(mappingReport.includes(expected), `mapping report should include ${expected}`);
    await client.evaluate('document.querySelector("#syntax-mapping-conflicts-close").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#syntax-mapping-conflicts-dialog").open'), 'mapping conflict report closes');
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#settings-popover").getAttribute("aria-hidden") === "false"'), 'view settings reopen');
    await client.evaluate('document.querySelector("#syntax-menu-settings").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#syntax-menu-dialog").open && document.querySelectorAll("#syntax-menu-list input[data-syntax-id]").length > 60'), 'customize syntax menu dialog');
    await inspectAccessibleControls(client, 'customize syntax menu dialog', [
      { role: 'dialog', name: '自定义语法菜单' },
      { role: 'searchbox', name: '筛选语法' },
      { role: 'button', name: '显示全部' },
      { role: 'checkbox', name: 'JavaScript' },
      { role: 'button', name: '应用' }
    ]);
    assert.equal(await client.evaluate('Boolean(document.querySelector("#syntax-menu-list input[data-syntax-id=javascript]"))'), true, 'the built-in language is available to customize');
    await client.evaluate(`(() => { const checkbox = document.querySelector('#syntax-menu-list input[data-syntax-id="javascript"]'); checkbox.checked = false; checkbox.dispatchEvent(new Event('change', {bubbles:true})); document.querySelector('#syntax-menu-apply').click(); return true; })()`);
    await waitFor(async () => client.evaluate(`!document.querySelector('#language-select option[value="javascript"]') && JSON.parse(localStorage.getItem('cotedit.settings.v1')).hiddenSyntaxes.includes('javascript')`), 'hidden syntax preference applies and persists');
    await client.evaluate('document.querySelector("#syntax-menu-settings").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#syntax-menu-dialog").open'), 'reopen syntax menu dialog');
    await client.evaluate(`(() => { const checkbox = document.querySelector('#syntax-menu-list input[data-syntax-id="javascript"]'); checkbox.checked = true; checkbox.dispatchEvent(new Event('change', {bubbles:true})); document.querySelector('#syntax-menu-cancel').click(); return true; })()`);
    await waitFor(async () => client.evaluate(`!document.querySelector('#syntax-menu-dialog').open && !document.querySelector('#language-select option[value="javascript"]') && JSON.parse(localStorage.getItem('cotedit.settings.v1')).hiddenSyntaxes.includes('javascript')`), 'cancelled syntax changes are discarded and the dialog closes');
    await client.evaluate('document.querySelector("#syntax-menu-settings").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#syntax-menu-dialog").open'), 'reopen syntax menu dialog after cancel');
    await client.evaluate('document.querySelector("#syntax-menu-show-all").click(); document.querySelector("#syntax-menu-apply").click(); true');
    await waitFor(async () => client.evaluate(`Boolean(document.querySelector('#language-select option[value="javascript"]')) && JSON.parse(localStorage.getItem('cotedit.settings.v1')).hiddenSyntaxes.length === 0`), 'show all syntaxes restores menu and selector');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'needle needle' });
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-line")?.textContent === "needle needle"'), 'highlight sample text');
    await client.key('Home', 'Home', 36);
    for (let index = 0; index < 6; index++) await client.key('ArrowRight', 'ArrowRight', 39, 8);
    await waitFor(async () => client.evaluate('Boolean(document.querySelector("#editor .cm-selectionMatch"))'), 'selected-text instance highlighting');
    const selectedTextMatchBackground = await client.evaluate('getComputedStyle(document.querySelector("#editor .cm-selectionMatch")).backgroundColor');
    assert.notEqual(selectedTextMatchBackground, 'rgba(0, 0, 0, 0)', 'the selected-text match should be visibly highlighted');
    assert.equal(await client.evaluate('Boolean(document.querySelector("#editor .cm-activeLine"))'), false, 'the current-line decoration is absent by default');
    await client.evaluate(`(() => { for (const [id, checked] of [['tabbar-setting', false], ['toolbar-setting', false], ['split-orientation-setting', true], ['highlight-current-line-setting', true], ['selected-text-matches-setting', false]]) { const input = document.querySelector('#' + id); input.checked = checked; input.dispatchEvent(new Event('change', {bubbles:true})); } const direction = document.querySelector('#writing-direction-setting'); direction.value = 'rtl'; direction.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate(`document.querySelector('.tabbar').classList.contains('hidden') && document.querySelector('.document-toolbar').classList.contains('hidden') && document.querySelector('.editor-shell').classList.contains('split-vertical') && Boolean(document.querySelector('#editor .cm-activeLine')) && !Boolean(document.querySelector('#editor .cm-selectionMatch'))`), 'view settings apply');
    const activeLineState = JSON.parse(await client.evaluate(`JSON.stringify((() => { const line = document.querySelector('#editor .cm-activeLine'); return {present:Boolean(line), background:line && getComputedStyle(line).backgroundColor}; })())`));
    assert.equal(activeLineState.present, true, `the focused editor should expose its current-line decoration: ${JSON.stringify(activeLineState)}`);
    assert.notEqual(activeLineState.background, 'rgba(0, 0, 0, 0)', 'the enabled active line background should be visible');
    const savedViewPreferences = JSON.parse(await client.evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('cotedit.settings.v1'))) `));
    assert.deepEqual({ tabbar: savedViewPreferences.showTabBar, toolbar: savedViewPreferences.showToolbar, verticalSplit: savedViewPreferences.splitEditorsVertically, writingDirection: savedViewPreferences.writingDirection, highlightCurrentLine: savedViewPreferences.highlightCurrentLine, highlightSelectionInstances: savedViewPreferences.highlightSelectionInstances }, { tabbar: false, toolbar: false, verticalSplit: true, writingDirection: 'rtl', highlightCurrentLine: true, highlightSelectionInstances: false });
    await client.evaluate(`(() => { for (const id of ['tabbar-setting', 'toolbar-setting']) { const input = document.querySelector('#' + id); input.checked = true; input.dispatchEvent(new Event('change', {bubbles:true})); } const highlight = document.querySelector('#highlight-current-line-setting'); highlight.checked = false; highlight.dispatchEvent(new Event('change', {bubbles:true})); const matches = document.querySelector('#selected-text-matches-setting'); matches.checked = true; matches.dispatchEvent(new Event('change', {bubbles:true})); const direction = document.querySelector('#writing-direction-setting'); direction.value = 'ltr'; direction.dispatchEvent(new Event('change', {bubbles:true})); document.querySelector('#settings-toggle').click(); return true; })()`);
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#editor .cm-activeLine") && Boolean(document.querySelector("#editor .cm-selectionMatch"))'), 'editor preferences restore');
    await waitFor(async () => client.evaluate('!document.querySelector(".tabbar").classList.contains("hidden") && !document.querySelector(".document-toolbar").classList.contains("hidden")'), 'view chrome restored');
    await client.key('a', 'KeyA', 65, 4);
    await client.key('Backspace', 'Backspace', 8);
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-line")?.textContent === ""'), 'temporary active-line sample cleared');

    const missingNames = await client.evaluate(`JSON.stringify([...document.querySelectorAll('.titlebar-actions button, .document-tools button')].filter(button => !(button.getAttribute('aria-label') || button.innerText.trim())).map(button => button.id))`);
    assert.deepEqual(JSON.parse(missingNames), [], 'toolbar buttons should have an accessible name');

    const baselineTabCount = await client.evaluate('document.querySelectorAll("#tabs [role=tab]").length');
    assert.ok(baselineTabCount >= 1, 'desktop launch should have an editable document');
    await client.evaluate('document.querySelector("#new-file").click(); true');
    await waitFor(async () => client.evaluate(`document.querySelectorAll("#tabs [role=tab]").length === ${baselineTabCount + 1} && document.querySelector(".cm-content[role=textbox]") !== null`), 'new editor tab');
    await client.evaluate('document.querySelector("#split-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.activeElement.closest("#editor-secondary") !== null'), 'split editor initially focuses secondary pane');
    const stackedSplitGeometry = JSON.parse(await client.evaluate(`JSON.stringify((() => { const primary = document.querySelector('#editor').getBoundingClientRect(); const secondary = document.querySelector('#editor-secondary').getBoundingClientRect(); return {primary:{top:primary.top,left:primary.left,width:primary.width,height:primary.height},secondary:{top:secondary.top,left:secondary.left,width:secondary.width,height:secondary.height}}; })())`));
    assert.ok(stackedSplitGeometry.secondary.top >= stackedSplitGeometry.primary.top + stackedSplitGeometry.primary.height - 1, 'vertical split places the secondary editor below the primary editor');
    assert.ok(stackedSplitGeometry.secondary.width > stackedSplitGeometry.secondary.height, 'stacked editor panes use the available horizontal width');
    const nextEditorModifier = await client.evaluate(`(() => { const platform = window.cotedit?.platform || navigator.platform; return platform === 'darwin' || /Mac/i.test(String(platform)) ? 4 : 2; })()`);
    await client.key('`', 'Backquote', 192, nextEditorModifier);
    await waitFor(async () => client.evaluate('document.activeElement.closest("#editor") !== null'), 'Command/Ctrl+Backquote focuses the next editor pane');
    await client.key('`', 'Backquote', 192, nextEditorModifier + (nextEditorModifier === 4 ? 1 : 8));
    await waitFor(async () => client.evaluate('document.activeElement.closest("#editor-secondary") !== null'), 'Option+Command/Shift+Ctrl+Backquote focuses the previous editor pane');
    await client.evaluate('document.querySelector("#split-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#split-editor").classList.contains("hidden") && document.activeElement.closest("#editor") !== null'), 'split focus test restores the single-editor state');
    const initialPanel = await client.evaluate(`JSON.stringify({role:document.querySelector('#editor').getAttribute('role'),labelledby:document.querySelector('#editor').getAttribute('aria-labelledby'),tabId:document.querySelector('#tabs [role=tab][aria-selected="true"]')?.id,selected:document.querySelector('#tabs [role=tab][aria-selected="true"]')?.getAttribute('aria-selected')})`);
    const panel = JSON.parse(initialPanel);
    assert.equal(panel.role, 'tabpanel');
    assert.equal(panel.labelledby, panel.tabId);
    assert.equal(panel.selected, 'true');

    await client.send('Input.insertText', { text: 'needle' });
    await client.key('Home', 'Home', 36);
    await client.key('End', 'End', 35, 8);
    await waitFor(async () => client.evaluate('window.getSelection()?.toString() === "needle"'), 'editor text selection');
    await client.evaluate(`document.querySelector('#custom-surround-dialog').showModal();
      const begin = document.querySelector('#custom-surround-begin');
      begin.value = '<<'; begin.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('#custom-surround-end').value = '>>';
      document.querySelector('#custom-surround-form').requestSubmit(); true`);
    await waitFor(async () => client.evaluate('document.querySelector("#custom-surround-dialog").open === false && document.querySelector("#editor .cm-content").textContent === "<<needle>>"'), 'custom surround edit');

    await client.key('l', 'KeyL', 76, 4);
    await waitFor(async () => client.evaluate('document.querySelector("#custom-surround-dialog").open && document.activeElement.id === "custom-surround-begin"'), 'Ctrl+L opens custom surround for a selected editor range');
    await inspectAccessibleControls(client, 'custom surround dialog', [
      { role: 'dialog', name: '自定义包围选区' },
      { role: 'textbox', name: '开始字符串' },
      { role: 'textbox', name: '结束字符串' }
    ]);
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('!document.querySelector("#custom-surround-dialog").open && document.activeElement.matches(".cm-content[role=textbox]")'), 'custom surround Escape returns focus to the editor');
    await client.key('ArrowRight', 'ArrowRight', 39);
    await client.key('l', 'KeyL', 76, 4);
    await waitFor(async () => client.evaluate('document.querySelector("#goto-line-dialog").open && document.activeElement.id === "goto-line-number"'), 'Ctrl+L opens Go to Line without a selection');
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('!document.querySelector("#goto-line-dialog").open'), 'Go to Line Escape closes the dialog');

    await client.click('#find-button');
    await waitFor(async () => client.evaluate('document.querySelector("#find-button").getAttribute("aria-expanded") === "true" && document.activeElement.id === "search-query"'), 'search panel open and focused');
    await inspectAccessibleControls(client, 'search panel', [
      { role: 'textbox', name: '查找文本或正则表达式' },
      { role: 'textbox', name: '替换为' },
      { role: 'button', name: '整词匹配' }
    ]);
    await client.evaluate(`const searchInput = document.querySelector('#search-query');
      searchInput.value = 'need'; searchInput.dispatchEvent(new Event('input', {bubbles:true})); true`);
    await waitFor(async () => client.evaluate('document.querySelector("#match-count").textContent === "1 项"'), 'ordinary substring search count');
    await client.evaluate('document.querySelector("#match-whole-word").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#match-whole-word").getAttribute("aria-pressed") === "true" && document.querySelector("#match-count").textContent === "0 项"'), 'whole-word mode excludes a partial word');
    await client.evaluate(`const replaceInput = document.querySelector('#replace-query');
      replaceInput.value = 'X'; true`);
    await client.evaluate('document.querySelector("#replace-all").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-content").textContent === "<<needle>>"'), 'whole-word replace-all leaves a partial word unchanged');
    await client.evaluate('document.querySelector("#match-whole-word").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#match-whole-word").getAttribute("aria-pressed") === "false" && document.querySelector("#match-count").textContent === "1 项"'), 'whole-word mode can be switched off');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    assert.equal(await client.evaluate('document.activeElement.matches(".cm-content[role=textbox]") && document.querySelector("#find-button").getAttribute("aria-expanded") === "true"'), true, 'the editor can own focus while the search panel remains open');
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('document.querySelector("#find-button").getAttribute("aria-expanded") === "false" && document.querySelector("#search-panel").classList.contains("hidden") && document.activeElement.matches(".cm-content[role=textbox]")'), 'Escape closes the search panel from editor focus and keeps editing focus');

    await client.click('#find-button');
    await client.evaluate('document.querySelector("#custom-surround-dialog").showModal(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#custom-surround-dialog").open && document.querySelector("#find-button").getAttribute("aria-expanded") === "true"'), 'native dialog opens above the search panel');
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('!document.querySelector("#custom-surround-dialog").open && document.querySelector("#find-button").getAttribute("aria-expanded") === "true" && !document.querySelector("#search-panel").classList.contains("hidden")'), 'Escape closes the modal dialog without dismissing the search panel beneath it');
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('document.querySelector("#search-panel").classList.contains("hidden")'), 'Escape closes the search panel after modal dismissal');

    await client.evaluate('document.querySelector("#new-file").click(); true');
    await waitFor(async () => client.evaluate(`document.querySelectorAll("#tabs [role=tab]").length === ${baselineTabCount + 2}`), 'second new editor tab');
    await client.send('Input.insertText', { text: 'item10\nitem2\nitem1' });
    await waitFor(async () => client.evaluate('document.querySelectorAll("#editor .cm-line").length === 3'), 'sortable sample lines');
    await client.evaluate(`(() => {
      const dialog = document.querySelector('#pattern-sort-dialog');
      const setValue = (id, value, type = 'input') => { const field = document.querySelector(id); field.value = value; field.dispatchEvent(new Event(type, {bubbles:true})); };
      const setChecked = (id, value) => { const field = document.querySelector(id); field.checked = value; field.dispatchEvent(new Event('change', {bubbles:true})); };
      dialog.showModal();
      setValue('#pattern-sort-key', 'regexp', 'change');
      setValue('#pattern-sort-regexp', '(a+)+$');
      const unsafeRejected = document.querySelector('#pattern-sort-submit').disabled && document.querySelector('#pattern-sort-error').textContent.includes('安全');
      setValue('#pattern-sort-regexp', '^item(\\\\d+)$');
      setChecked('#pattern-sort-use-capture', true);
      setValue('#pattern-sort-capture-index', '1');
      if (!unsafeRejected || document.querySelector('#pattern-sort-submit').disabled) throw new Error('Pattern dialog did not reject an unsafe rule and accept the safe numeric capture.');
      document.querySelector('#pattern-sort-form').requestSubmit();
      return true;
    })()`);
    await waitFor(async () => client.evaluate(`JSON.stringify([...document.querySelectorAll('#editor .cm-line')].map(line => line.textContent)) === ${JSON.stringify(JSON.stringify(['item1', 'item2', 'item10']))}`), 'safe numeric regex-key sort');
    await client.key('a', 'KeyA', 65, 4);
    await client.send('Input.insertText', { text: 'Z,12\nA,2\nB,10' });
    await waitFor(async () => client.evaluate('document.querySelectorAll("#editor .cm-line").length === 3'), 'CSV column sample lines');
    await client.evaluate(`(() => {
      const dialog = document.querySelector('#pattern-sort-dialog');
      const setValue = (id, value, type = 'input') => { const field = document.querySelector(id); field.value = value; field.dispatchEvent(new Event(type, {bubbles:true})); };
      dialog.showModal();
      setValue('#pattern-sort-key', 'column', 'change');
      setValue('#pattern-sort-delimiter', ',');
      setValue('#pattern-sort-column', '2', 'change');
      if (document.querySelector('#pattern-sort-submit').disabled) throw new Error('CSV column sort unexpectedly disabled.');
      document.querySelector('#pattern-sort-form').requestSubmit();
      return true;
    })()`);
    await waitFor(async () => client.evaluate(`JSON.stringify([...document.querySelectorAll('#editor .cm-line')].map(line => line.textContent)) === ${JSON.stringify(JSON.stringify(['A,2', 'B,10', 'Z,12']))}`), 'numeric CSV column sort');
    await client.key('a', 'KeyA', 65, 4);
    await client.send('Input.insertText', { text: Array.from({ length: 900 }, (_, index) => index === 0 ? '# Beginning' : index === 899 ? '# Remote line-900' : `line-${index + 1}`).join('\n') });
    await client.evaluate(`(() => { const setting = document.querySelector('#vertical-text-setting');
      setting.checked = true; setting.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('document.querySelector(".editor-shell").classList.contains("vertical-text")'), 'vertical text setting applied');
    await client.key('l', 'KeyL', 76, 4);
    await waitFor(async () => client.evaluate('document.querySelector("#goto-line-dialog").open && Number(document.querySelector("#goto-line-number").max) >= 900'), 'long-document Go to Line dialog');
    await client.evaluate(`document.querySelector('#goto-line-number').value = '900';
      document.querySelector('#goto-line-form').requestSubmit(); true`);
    await waitFor(async () => client.evaluate('!document.querySelector("#goto-line-dialog").open'), 'Go to Line submits for vertical long document');
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const verticalJump = JSON.parse(await client.evaluate(`(() => {
      const scroller = document.querySelector('#editor .cm-scroller');
      const line = document.querySelector('#editor .cm-line[data-line-number="900"]');
      const bounds = scroller.getBoundingClientRect();
      const rect = line?.getBoundingClientRect();
      return JSON.stringify({
        vertical: document.querySelector('.editor-shell').classList.contains('vertical-text'),
        scrollLeft: scroller.scrollLeft, scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth,
        scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight,
        overflowY: getComputedStyle(scroller).overflowY,
        contentTransform: document.querySelector('#editor .cm-content').style.transform,
        lineMounted: Boolean(line), lineRect: rect && {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
        lineText: line?.textContent, cursorRect: (() => {const cursor=document.querySelector('#editor .cm-cursor');if(!cursor)return null;const r=cursor.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})(),
        scrollerRect: {left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom},
        contentRect: (() => {const content=document.querySelector('#editor .cm-content').getBoundingClientRect();return {left:content.left,right:content.right,top:content.top,bottom:content.bottom,width:content.width,height:content.height}})(),
        cursorVisible: (() => {const cursor=document.querySelector('#editor .cm-cursor');if(!cursor)return false;const r=cursor.getBoundingClientRect();return r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1})()
      });
    })()`));
    assert.equal(verticalJump.vertical, true);
    assert.equal(verticalJump.lineMounted, true, 'CodeMirror should mount the requested remote vertical line');
    assert.ok(verticalJump.scrollWidth > verticalJump.clientWidth, `vertical documents should expose a physical horizontal scroll range: ${JSON.stringify(verticalJump)}`);
    assert.equal(verticalJump.cursorVisible, true, `remote vertical caret should be inside the scroller after Go to Line: ${JSON.stringify(verticalJump)}`);
    await client.evaluate(`(() => { const language = document.querySelector('#language-select');
      language.value = 'python'; language.dispatchEvent(new Event('change', {bubbles:true}));
      language.value = 'markdown'; language.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate(`(() => {
      const settings = JSON.parse(localStorage.getItem('cotedit.settings.v1') || '{}');
      const select = document.querySelector('#language-select');
      const recent = [...select.querySelectorAll('optgroup[label="最近使用"] option')].map(option => option.value);
      return JSON.stringify(settings.recentSyntaxes?.slice(-2)) === JSON.stringify(['python', 'markdown'])
        && recent.slice(0, 2).join(',') === 'markdown,python'
        && select.querySelector('optgroup[label="所有语法"] option[value="markdown"]')?.textContent === 'Markdown';
    })()`), 'manual syntax selection persists in recent and complete syntax groups');
    await client.evaluate(`(() => {
      const key = 'cotedit.settings.v1'; const settings = JSON.parse(localStorage.getItem(key));
      settings.hiddenSyntaxes = [...new Set([...settings.hiddenSyntaxes, 'markdown'])];
      const value = JSON.stringify(settings); localStorage.setItem(key, value);
      window.dispatchEvent(new StorageEvent('storage', {key, newValue:value})); return true;
    })()`);
    await waitFor(async () => client.evaluate(`(() => {
      const select = document.querySelector('#language-select');
      const recent = select.querySelector('optgroup[label="最近使用"] option[value="markdown"]');
      return Boolean(recent && !recent.disabled && !select.querySelector('optgroup[label="所有语法"] option[value="markdown"]'));
    })()`), 'hidden syntax remains available in the recent group');
    await client.evaluate(`(() => {
      const key = 'cotedit.settings.v1'; const settings = JSON.parse(localStorage.getItem(key));
      settings.hiddenSyntaxes = settings.hiddenSyntaxes.filter(id => id !== 'markdown');
      const value = JSON.stringify(settings); localStorage.setItem(key, value);
      window.dispatchEvent(new StorageEvent('storage', {key, newValue:value})); return true;
    })()`);
    await client.evaluate('document.querySelector("#outline-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#outline-toggle").getAttribute("aria-expanded") === "true" && !document.querySelector("#outline-panel").classList.contains("hidden")'), 'long-document outline open');
    await waitFor(async () => client.evaluate('[...document.querySelectorAll("#outline-items .outline-item")].some(item => item.dataset.line === "900" && item.textContent.includes("Remote line-900"))'), 'remote Markdown heading in outline');
    await client.evaluate(`[...document.querySelectorAll('#outline-items .outline-item')].find(item => item.dataset.line === '900')?.click(); true`);
    await waitFor(async () => client.evaluate('document.querySelector("#outline-panel").classList.contains("hidden") && document.querySelector("#cursor-position").textContent.includes("900")'), 'outline navigates to remote vertical heading');
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const verticalOutline = JSON.parse(await client.evaluate(`(() => {
      const scroller=document.querySelector('#editor .cm-scroller');
      const bounds=scroller.getBoundingClientRect();
      const cursor=document.querySelector('#editor .cm-cursor');
      const rect=cursor?.getBoundingClientRect();
      return JSON.stringify({scrollTop:scroller.scrollTop,scrollLeft:scroller.scrollLeft,scrollWidth:scroller.scrollWidth,clientWidth:scroller.clientWidth,
        overflowY:getComputedStyle(scroller).overflowY,contentTransform:document.querySelector('#editor .cm-content').style.transform,
        cursorVisible:Boolean(rect&&rect.left>=bounds.left-1&&rect.right<=bounds.right+1&&rect.top>=bounds.top-1&&rect.bottom<=bounds.bottom+1)});
    })()`));
    assert.ok(verticalOutline.scrollTop > 0, `CodeMirror's virtual line viewport should advance while its physical y offset is compensated: ${JSON.stringify(verticalOutline)}`);
    assert.equal(verticalOutline.overflowY, 'auto');
    assert.equal(verticalOutline.contentTransform, '');
    assert.ok(verticalOutline.scrollWidth > verticalOutline.clientWidth);
    assert.equal(verticalOutline.cursorVisible, true, `outline target should be visible in vertical mode: ${JSON.stringify(verticalOutline)}`);
    await client.evaluate(`(()=>{const scroller=document.querySelector('#editor .cm-scroller');scroller.scrollLeft=Math.floor((scroller.scrollWidth-scroller.clientWidth)/2);return true})()`);
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await waitFor(async () => client.evaluate(`(()=>{const s=document.querySelector('#editor .cm-scroller');const b=s.getBoundingClientRect();return [...document.querySelectorAll('#editor .cm-line[data-line-number]')].some(line=>{const n=Number(line.dataset.lineNumber);const r=line.getBoundingClientRect();return n>=440&&n<=460&&r.left>=b.left-1&&r.right<=b.right+1})})()`), 'horizontal scrolling materializes a midpoint vertical column');
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const horizontalScroll = JSON.parse(await client.evaluate(`(()=>{const scroller=document.querySelector('#editor .cm-scroller');const bounds=scroller.getBoundingClientRect();const lines=[...document.querySelectorAll('#editor .cm-line[data-line-number]')].map(line=>{const rect=line.getBoundingClientRect();return {number:Number(line.dataset.lineNumber),left:rect.left,right:rect.right,visible:rect.left>=bounds.left-1&&rect.right<=bounds.right+1}});return JSON.stringify({scrollLeft:scroller.scrollLeft,scrollWidth:scroller.scrollWidth,clientWidth:scroller.clientWidth,lines:lines.filter(line=>line.visible),activeLine:document.querySelector('#cursor-position').textContent})})()`));
    assert.ok(horizontalScroll.scrollLeft > 0 && horizontalScroll.scrollLeft < horizontalScroll.scrollWidth - horizontalScroll.clientWidth, `horizontal scrolling should reach the document midpoint: ${JSON.stringify(horizontalScroll)}`);
    assert.ok(horizontalScroll.lines.some(line => line.number >= 440 && line.number <= 460), `a midpoint logical line should be mounted and visible: ${JSON.stringify(horizontalScroll)}`);
    assert.match(horizontalScroll.activeLine, /900/, 'horizontal scrolling should not move the insertion point');
    await client.key('l', 'KeyL', 76, 4);
    await waitFor(async () => client.evaluate('document.querySelector("#goto-line-dialog").open'), 'vertical long-document return navigation');
    await client.evaluate(`document.querySelector('#goto-line-number').value = '1';
      document.querySelector('#goto-line-form').requestSubmit(); true`);
    await waitFor(async () => client.evaluate('!document.querySelector("#goto-line-dialog").open'), 'return to first vertical line');
    await client.evaluate('document.querySelector("#find-button").click(); true');
    await waitFor(async () => client.evaluate('document.activeElement.id === "search-query"'), 'vertical long-document search focus');
    await client.evaluate(`const query = document.querySelector('#search-query');
      query.value = 'line-900'; query.dispatchEvent(new Event('input', {bubbles:true})); true`);
    await client.evaluate('document.querySelector("#find-next").click(); true');
    await waitFor(async () => client.evaluate('window.getSelection()?.toString() === "line-900"'), 'remote vertical search match selected');
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const verticalSearch = JSON.parse(await client.evaluate(`(() => {
      const scroller=document.querySelector('#editor .cm-scroller');
      const bounds=scroller.getBoundingClientRect();
      const selection=window.getSelection();
      const rect=selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
      return JSON.stringify({selected:selection?.toString(),scrollTop:scroller.scrollTop,
        selectionRect:rect&&{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
        selectionVisible:Boolean(rect&&rect.left>=bounds.left-1&&rect.right<=bounds.right+1&&rect.top>=bounds.top-1&&rect.bottom<=bounds.bottom+1)});
    })()`));
    assert.equal(verticalSearch.selected, 'line-900');
    assert.ok(verticalSearch.scrollTop > 0, `search should position the virtual row viewport at its result: ${JSON.stringify(verticalSearch)}`);
    assert.equal(verticalSearch.selectionVisible, true, `remote vertical search selection should be visible: ${JSON.stringify(verticalSearch)}`);
    await client.evaluate('document.querySelector("#search-close").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#search-panel").classList.contains("hidden")'), 'vertical search panel close');
    await client.key('a', 'KeyA', 65, 4);
    await client.send('Input.insertText', { text: '縦'.repeat(6000) });
    await waitFor(async () => client.evaluate(`(() => {
      const scroller = document.querySelector('#editor .cm-scroller');
      return document.querySelectorAll('#editor .cm-line').length === 1 && scroller.scrollHeight > scroller.clientHeight;
    })()`), 'long single-line vertical document');
    await client.key('End', 'End', 35);
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const longVerticalLine = JSON.parse(await client.evaluate(`(() => {
      const scroller = document.querySelector('#editor .cm-scroller');
      const bounds = scroller.getBoundingClientRect();
      const cursor = document.querySelector('#editor .cm-cursor');
      const rect = cursor?.getBoundingClientRect();
      return JSON.stringify({
        lineCount: document.querySelectorAll('#editor .cm-line').length,
        scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight,
        cursorVisible: Boolean(rect && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1)
      });
    })()`));
    assert.equal(longVerticalLine.lineCount, 1, `long vertical sample should remain one logical line: ${JSON.stringify(longVerticalLine)}`);
    assert.ok(longVerticalLine.scrollHeight > longVerticalLine.clientHeight, `long vertical text should expose physical block-axis scrolling: ${JSON.stringify(longVerticalLine)}`);
    assert.ok(longVerticalLine.scrollTop > 0, `the end of a long vertical line should be reachable: ${JSON.stringify(longVerticalLine)}`);
    assert.equal(longVerticalLine.cursorVisible, true, `the end caret of a long vertical line should remain visible: ${JSON.stringify(longVerticalLine)}`);
    await client.evaluate(`(() => { const setting = document.querySelector('#vertical-text-setting');
      setting.checked = false; setting.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('!document.querySelector(".editor-shell").classList.contains("vertical-text")'), 'vertical text setting restored');
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#settings-popover").classList.contains("hidden")'), 'settings open for page guide controls');
    const pageGuideDefaults = JSON.parse(await client.evaluate(`JSON.stringify({enabled:document.querySelector('#page-guide-setting').checked,column:document.querySelector('#page-guide-column').value,disabled:document.querySelector('#page-guide-column').disabled})`));
    assert.deepEqual(pageGuideDefaults, { enabled: false, column: '80', disabled: true });
    await client.evaluate(`(() => { const enabled = document.querySelector('#page-guide-setting');
      enabled.checked = true; enabled.dispatchEvent(new Event('change', {bubbles:true}));
      const column = document.querySelector('#page-guide-column'); column.value = '80'; column.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).showPageGuide === true && !document.querySelector("#editor .page-guide")?.hidden && !document.querySelector("#page-guide-column").disabled'), 'page guide enabled with CotEditor default column');
    const pageGuideGeometry = JSON.parse(await client.evaluate(`(() => { const guide = document.querySelector('#editor .page-guide');
      const content = document.querySelector('#editor .cm-content');
      return JSON.stringify({guideLeft:guide.getBoundingClientRect().left,contentLeft:content.getBoundingClientRect().left,vertical:guide.classList.contains('vertical')}); })()`));
    assert.equal(pageGuideGeometry.vertical, false);
    assert.ok(pageGuideGeometry.guideLeft > pageGuideGeometry.contentLeft, `page guide should be positioned after the editor text origin: ${JSON.stringify(pageGuideGeometry)}`);
    await client.evaluate(`(() => { const setting = document.querySelector('#vertical-text-setting');
      setting.checked = true; setting.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('document.querySelector(".editor-shell").classList.contains("vertical-text") && document.querySelector("#editor .page-guide").classList.contains("vertical")'), 'page guide follows vertical text orientation');
    const verticalGuideGeometry = JSON.parse(await client.evaluate(`(() => { const guide = document.querySelector('#editor .page-guide');
      const scroller = document.querySelector('#editor .cm-scroller');
      return JSON.stringify({guideWidth:guide.getBoundingClientRect().width,scrollerWidth:scroller.clientWidth}); })()`));
    assert.ok(verticalGuideGeometry.guideWidth >= verticalGuideGeometry.scrollerWidth - 1, `vertical page guide should span the editor viewport: ${JSON.stringify(verticalGuideGeometry)}`);
    await client.evaluate(`(() => { const setting = document.querySelector('#vertical-text-setting');
      setting.checked = false; setting.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('!document.querySelector(".editor-shell").classList.contains("vertical-text") && !document.querySelector("#editor .page-guide").classList.contains("vertical")'), 'page guide returns to horizontal orientation');
    await client.evaluate(`(() => { const enabled = document.querySelector('#page-guide-setting');
      enabled.checked = false; enabled.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('!JSON.parse(localStorage.getItem("cotedit.settings.v1")).showPageGuide && document.querySelector("#editor .page-guide").hidden && document.querySelector("#page-guide-column").disabled'), 'page guide hides and disables its column control');
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#settings-popover").classList.contains("hidden")'), 'settings close after page guide test');

    const defaultToolbarOrder = ['find', 'directorySearch', 'outline', 'split', 'characterInspector', 'warningsInspector', 'wrap', 'lineNumbers'];
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#settings-popover").classList.contains("hidden")'), 'settings open for toolbar customization');
    await client.evaluate('document.querySelector("#toolbar-customize-open").scrollIntoView({block:"center"}); true');
    await client.click('#toolbar-customize-open');
    await waitFor(async () => client.evaluate('document.querySelector("#toolbar-customization-dialog").open && document.activeElement.matches("#toolbar-customization-list input[type=checkbox]")'), 'toolbar customization opens with focus on its first option');
    await inspectAccessibleControls(client, 'toolbar customization dialog', [
      { role: 'dialog', name: '自定义工具栏' },
      { role: 'checkbox', name: '显示查找与替换' },
      { role: 'button', name: '将“查找与替换”下移' }
    ]);
    await client.evaluate(`(() => { const checkbox = document.querySelector('#toolbar-customization-list input[data-toolbar-visibility="outline"]');
      checkbox.checked = false; checkbox.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await client.click('#toolbar-customization-list button[data-toolbar-id="directorySearch"][data-toolbar-move="up"]');
    await client.click('#toolbar-customization-cancel');
    await waitFor(async () => client.evaluate('!document.querySelector("#toolbar-customization-dialog").open && document.activeElement.id === "settings-toggle"'), 'cancel closes toolbar customization and restores focus');
    let toolbarState = JSON.parse(await client.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("cotedit.settings.v1")))'));
    assert.deepEqual(toolbarState.toolbarItemOrder, defaultToolbarOrder, 'cancel leaves toolbar order unchanged');
    assert.deepEqual(toolbarState.hiddenToolbarItems, [], 'cancel leaves toolbar visibility unchanged');
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#settings-popover").classList.contains("hidden")'), 'settings reopen for applying toolbar changes');
    await client.evaluate('document.querySelector("#toolbar-customize-open").scrollIntoView({block:"center"}); true');
    await client.click('#toolbar-customize-open');
    await waitFor(async () => client.evaluate('document.querySelector("#toolbar-customization-dialog").open'), 'toolbar customization reopens');
    await client.click('#toolbar-customization-list button[data-toolbar-id="directorySearch"][data-toolbar-move="up"]');
    await client.evaluate(`(() => { const checkbox = document.querySelector('#toolbar-customization-list input[data-toolbar-visibility="outline"]');
      checkbox.checked = false; checkbox.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await client.click('#toolbar-customization-apply');
    await waitFor(async () => client.evaluate(`(() => { const stored = JSON.parse(localStorage.getItem('cotedit.settings.v1'));
      return !document.querySelector('#toolbar-customization-dialog').open && stored.toolbarItemOrder[0] === 'directorySearch' && stored.hiddenToolbarItems.includes('outline'); })()`), 'toolbar order and visibility persist after apply');
    toolbarState = JSON.parse(await client.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("cotedit.settings.v1")))'));
    assert.deepEqual(toolbarState.toolbarItemOrder, ['directorySearch', ...defaultToolbarOrder.filter(id => id !== 'directorySearch')]);
    assert.deepEqual(toolbarState.hiddenToolbarItems, ['outline']);
    assert.equal(await client.evaluate('document.querySelector("#outline-toggle").hidden'), true, 'hidden toolbar items leave the visible toolbar');
    assert.equal(await client.evaluate('getComputedStyle(document.querySelector("#outline-toggle")).display'), 'none', 'hidden toolbar items are absent from the rendered layout');
    assert.equal(await client.evaluate('document.querySelector(".document-tools").firstElementChild.id'), 'directory-search-button', 'toolbar buttons follow the configured order');
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#settings-popover").classList.contains("hidden")'), 'settings reopen for toolbar reset');
    await waitFor(async () => client.evaluate('document.activeElement.id === "font-down"'), 'settings initial focus settles before toolbar reset');
    await client.evaluate('document.querySelector("#toolbar-customize-open").scrollIntoView({block:"center"}); true');
    await waitFor(async () => client.evaluate(`(() => { const button = document.querySelector('#toolbar-customize-open'); const rect = button.getBoundingClientRect(); const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return rect.width > 0 && rect.height > 0 && (hit === button || button.contains(hit)); })()`), 'toolbar reset button is stable and hit-testable');
    await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await client.click('#toolbar-customize-open');
    await waitFor(async () => client.evaluate('document.querySelector("#toolbar-customization-dialog").open'), 'toolbar customization opens for default reset');
    await client.click('#toolbar-customization-reset');
    await client.click('#toolbar-customization-apply');
    await waitFor(async () => client.evaluate(`(() => { const stored = JSON.parse(localStorage.getItem('cotedit.settings.v1'));
      return stored.toolbarItemOrder.join(',') === ${JSON.stringify(defaultToolbarOrder.join(','))} && stored.hiddenToolbarItems.length === 0 && !document.querySelector('#outline-toggle').hidden; })()`), 'toolbar reset restores default order and visibility');
    await waitFor(async () => client.evaluate('document.activeElement.id === "settings-toggle" && document.querySelector("#settings-popover").classList.contains("hidden")'), 'applying toolbar defaults closes settings and returns focus');

    const tabIds = JSON.parse(await client.evaluate(`JSON.stringify([...document.querySelectorAll('#tabs [role=tab]')].map(tab => tab.dataset.id))`));
    await client.evaluate('[...document.querySelectorAll("#tabs [role=tab]")].at(-1)?.focus()');
    await client.key('ArrowLeft', 'ArrowLeft', 37);
    await waitFor(async () => client.evaluate(`document.querySelector('#tabs [role=tab][aria-selected="true"]')?.dataset.id === ${JSON.stringify(tabIds.at(-2))} && document.activeElement.matches('[role=tab]')`), 'left arrow tab navigation');
    await client.key('ArrowRight', 'ArrowRight', 39);
    await waitFor(async () => client.evaluate(`document.querySelector('#tabs [role=tab][aria-selected="true"]')?.dataset.id === ${JSON.stringify(tabIds.at(-1))}`), 'right arrow tab navigation');

    const currentTabCount = await client.evaluate('document.querySelectorAll("#tabs [role=tab]").length');
    const documentsToAdd = Math.max(0, 6 - currentTabCount);
    await client.evaluate(`for (let index = 0; index < ${documentsToAdd}; index++) document.querySelector("#new-file").click(); true`);
    await waitFor(async () => client.evaluate('document.querySelectorAll("#tabs [role=tab]").length >= 6 && !document.querySelector("#tab-overflow").classList.contains("hidden")'), 'overflow tabs');
    await client.evaluate('document.querySelector("#tab-overflow").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#tab-overflow").getAttribute("aria-expanded") === "true" && document.querySelectorAll("#tab-overflow-menu [role=menuitemradio]").length === document.querySelectorAll("#tabs [role=tab]").length'), 'overflow menu open');
    await waitFor(async () => client.evaluate('document.activeElement.matches("#tab-overflow-menu [role=menuitemradio]")'), 'overflow menu initially focuses a document');
    await client.key('Home', 'Home', 36);
    await waitFor(async () => client.evaluate('document.activeElement === document.querySelector("#tab-overflow-menu [role=menuitemradio]:first-child")'), 'overflow Home navigation');
    await client.key('End', 'End', 35);
    await waitFor(async () => client.evaluate('document.activeElement === document.querySelector("#tab-overflow-menu [role=menuitemradio]:last-child")'), 'overflow End navigation');
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('document.querySelector("#tab-overflow").getAttribute("aria-expanded") === "false" && document.activeElement.id === "tab-overflow"'), 'overflow menu Escape and focus return');

    await client.evaluate('document.querySelector("#shortcuts-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-dialog").open && document.activeElement.id === "shortcuts-query"'), 'keyboard shortcut dialog opens with search focus');
    await inspectAccessibleControls(client, 'keyboard shortcut dialog', [
      { role: 'dialog', name: '键盘快捷键' }
    ]);
    await client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-id=save]").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-id=save]")?.getAttribute("aria-pressed") === "true"'), 'shortcut capture mode begins');
    const captureUsesMeta = await client.evaluate(`(() => { const platform = window.cotedit?.platform || navigator.platform; return platform === 'darwin' || /Mac/i.test(String(platform)); })()`);
    const captureCommandModifier = captureUsesMeta ? 4 : 2;
    const ctrlAltXLabel = captureUsesMeta ? '⌃⌥X' : 'Ctrl + Alt + X';
    const ctrlSLabel = captureUsesMeta ? '⌘S' : 'Ctrl + S';
    // quickActions is bound to CmdOrCtrl+K, so the platform command modifier
    // collides with it while every other binding stays free.
    await client.key('k', 'KeyK', 75, captureCommandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#shortcut-capture-status").textContent.includes("已分配给")'), 'duplicate shortcut is rejected without leaving capture mode');
    await client.key('x', 'KeyX', 88, 3);
    await waitFor(async () => client.evaluate(`document.querySelector("#shortcuts-list [data-shortcut-id=save]")?.textContent.includes(${JSON.stringify(ctrlAltXLabel)}) && JSON.parse(localStorage.getItem("cotedit.settings.v1")).keyBindings.save.key === "x"`), 'custom shortcut persists and is reflected in the list');
    await client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-reset-id=save]").click(); true');
    await waitFor(async () => client.evaluate(`document.querySelector("#shortcuts-list [data-shortcut-id=save]")?.textContent === ${JSON.stringify(ctrlSLabel)} && document.querySelector("#shortcuts-list [data-shortcut-reset-id=save]").disabled`), 'single shortcut reset restores the platform default');
    await client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-id=toggleWrap]").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-id=toggleWrap]")?.getAttribute("aria-pressed") === "true"'), 'native menu shortcut capture begins');
    await client.key('x', 'KeyX', 88, 3);
    await waitFor(async () => client.evaluate(`document.querySelector("#shortcuts-list [data-shortcut-id=toggleWrap]")?.textContent.includes(${JSON.stringify(ctrlAltXLabel)})`), 'nonconflicting native menu shortcut is updated');
    await client.evaluate('document.querySelector("#shortcuts-close").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#shortcuts-dialog").open'), 'keyboard shortcut dialog closes');
    await client.key('x', 'KeyX', 88, 3);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).wrap === false'), 'custom shortcut dispatches its action');
    await client.key('x', 'KeyX', 88, 3);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).wrap === true'), 'custom shortcut remains active and reversible');
    await client.evaluate('document.querySelector("#shortcuts-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-dialog").open'), 'shortcut editor reopens');
    await client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-reset-id=toggleWrap]").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-reset-id=toggleWrap]").disabled'), 'custom shortcut can be restored to its default');
    await client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-id=toggleWrap]").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-id=toggleWrap]")?.getAttribute("aria-pressed") === "true"'), 'multi-character shortcut capture begins');
    await client.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'SS', code:'Unidentified', ctrlKey:true, altKey:true, shiftKey:true, bubbles:true, cancelable:true})); true`);
    await waitFor(async () => client.evaluate(`document.querySelector("#shortcuts-list [data-shortcut-id=toggleWrap]")?.textContent.includes(${JSON.stringify(captureUsesMeta ? '⌃⌥⇧SS' : 'Ctrl + Alt + Shift + SS')}) && JSON.parse(localStorage.getItem("cotedit.settings.v1")).keyBindings.toggleWrap.key === "SS"`), 'multi-character shortcut is stored and displayed');
    await client.evaluate('document.querySelector("#shortcuts-close").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#shortcuts-dialog").open'), 'shortcut editor closes before multi-character dispatch');
    await client.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'SS', code:'Unidentified', ctrlKey:true, altKey:true, shiftKey:true, bubbles:true, cancelable:true})); true`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).wrap === false'), 'multi-character shortcut dispatches its action');
    await client.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'SS', code:'Unidentified', ctrlKey:true, altKey:true, shiftKey:true, bubbles:true, cancelable:true})); true`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).wrap === true'), 'multi-character shortcut remains reversible');
    await client.evaluate('document.querySelector("#shortcuts-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-dialog").open'), 'shortcut editor reopens after multi-character dispatch');
    await client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-reset-id=toggleWrap]").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#shortcuts-list [data-shortcut-reset-id=toggleWrap]").disabled'), 'multi-character shortcut reset restores the default');
    await client.evaluate('document.querySelector("#shortcuts-close").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#shortcuts-dialog").open'), 'shortcut editor closes after multi-character reset');
    await client.evaluate('document.querySelector("#shortcuts-close").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#shortcuts-dialog").open'), 'shortcut editor closes after restoring its default');

    await client.evaluate('window.cotedit.saveRecoveryDrafts([])');
    await waitFor(async () => client.evaluate('window.cotedit.listRecoveryDrafts().then(items => items.length === 0)'), 'isolated recovery store starts empty');
    const restoredId = 'ui-recovery-smoke-restored';
    const restoredName = '恢复 UI smoke.txt';
    await client.evaluate('document.querySelector("#recovery-dialog").showModal(); true');
    await client.evaluate(`window.cotedit.importLegacyRecoveryDrafts([{windowId:'previous-smoke-window',drafts:[{id:${JSON.stringify(restoredId)},name:${JSON.stringify(restoredName)},text:'restored recovery body',savedText:'saved baseline'}]}])`);
    await waitFor(async () => client.evaluate(`Boolean(document.querySelector('#recovery-list input[data-recovery-id="${restoredId}"]:not(:disabled)'))`), 'legacy recovery draft appears in the manager');
    await inspectAccessibleControls(client, 'recovery manager dialog', [
      { role: 'dialog', name: '恢复未保存文稿' },
      { role: 'checkbox', name: `选择恢复文稿 ${restoredName}` },
      { role: 'button', name: '恢复所选' },
      { role: 'button', name: '删除所选' },
      { role: 'button', name: '稍后处理' }
    ]);
    await client.click('#recovery-restore-selected');
    await waitFor(async () => client.evaluate(`!document.querySelector('#recovery-dialog').open && document.querySelector('#editor .cm-content').textContent === 'restored recovery body'`), 'selected draft restores into a new editor tab');
    assert.equal(await client.evaluate(`window.cotedit.listRecoveryDrafts().then(items => items.some(item => item.id === ${JSON.stringify(restoredId)} && item.inUse))`), true, 'restored draft is protected from deletion while its editor remains open');
    await assert.rejects(client.evaluate(`window.cotedit.deleteRecoveryDrafts([${JSON.stringify(restoredId)}])`), /正在|编辑/);
    await client.evaluate('window.cotedit.saveRecoveryDrafts([])');
    await waitFor(async () => client.evaluate('window.cotedit.listRecoveryDrafts().then(items => items.length === 0)'), 'test snapshot cleanup clears current-window drafts');

    const deletedId = 'ui-recovery-smoke-delete';
    await client.evaluate('document.querySelector("#recovery-dialog").showModal(); true');
    await client.evaluate(`window.cotedit.importLegacyRecoveryDrafts([{windowId:'previous-delete-window',drafts:[{id:${JSON.stringify(deletedId)},name:'待删除 smoke.txt',text:'unsaved',savedText:''}]}])`);
    await waitFor(async () => client.evaluate(`Boolean(document.querySelector('#recovery-list input[data-recovery-id="${deletedId}"]:checked:not(:disabled)'))`), 'unclaimed draft becomes selectable');
    await client.click('#recovery-delete-selected');
    await waitFor(async () => client.evaluate(`window.cotedit.listRecoveryDrafts().then(items => !items.some(item => item.id === ${JSON.stringify(deletedId)}))`), 'selected unclaimed draft is deleted');

    const clearedId = 'ui-recovery-smoke-clear';
    await client.evaluate(`window.cotedit.importLegacyRecoveryDrafts([{windowId:'previous-clear-window',drafts:[{id:${JSON.stringify(clearedId)},name:'清空 smoke.txt',text:'unsaved',savedText:''}]}])`);
    await waitFor(async () => client.evaluate(`Boolean(document.querySelector('#recovery-list input[data-recovery-id="${clearedId}"]'))`), 'draft appears before clear-all confirmation');
    await client.evaluate('window.confirm = () => true; document.querySelector("#recovery-clear-all").click(); true');
    await waitFor(async () => client.evaluate('window.cotedit.listRecoveryDrafts().then(items => items.length === 0)'), 'confirmed clear-all removes the isolated test drafts');
    await client.evaluate('document.querySelector("#recovery-dialog").close(); true');

    const countTabCount = await client.evaluate('document.querySelectorAll("#tabs [role=tab]").length');
    await client.evaluate('document.querySelector("#new-file").click(); true');
    await waitFor(async () => client.evaluate(`document.querySelectorAll("#tabs [role=tab]").length === ${countTabCount + 1} && document.querySelector("#editor .cm-content")?.textContent === ""`), 'new document for advanced count smoke');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'A\u0308 🐱\n' });
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-content")?.textContent.includes("Ä 🐱")'), 'Unicode count fixture inserted');
    await client.evaluate('document.querySelector("#word-count").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#character-count-dialog").open'), 'advanced count options open');
    await inspectAccessibleControls(client, 'advanced character count dialog', [
      { role: 'dialog', name: '高级字符计数' },
      { role: 'combobox', name: '计数单位' },
      { role: 'checkbox', name: '忽略换行符' },
      { role: 'checkbox', name: '忽略空白' },
      { role: 'checkbox', name: '连续空白计为一个空格' }
    ]);
    await client.evaluate(`(() => {
      const set = (id, value) => { const control = document.querySelector(id); control.value = value; control.dispatchEvent(new Event('change', {bubbles:true})); };
      const check = id => { const control = document.querySelector(id); control.checked = true; control.dispatchEvent(new Event('change', {bubbles:true})); };
      set('#count-unit', 'scalar');
      check('#count-normalizes');
      set('#count-normalization-form', 'NFC');
      check('#count-ignores-newlines');
      check('#count-ignores-whitespaces');
      return document.querySelector('#count-collapse-whitespace').disabled;
    })()`);
    assert.equal(await client.evaluate('document.querySelector("#count-collapse-whitespace").disabled'), true, 'collapse option is disabled when both whitespace categories are ignored');
    await client.evaluate('document.querySelector("#character-count-apply").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#advanced-count-value")?.textContent === "2 Unicode 标量" && document.querySelector("#advanced-count-scope")?.textContent === "整个文稿"'), 'normalized and filtered full-document count');
    assert.equal(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).countNormalizationForm'), 'NFC', 'advanced count options persist');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'B' });
    await waitFor(async () => client.evaluate('document.querySelector("#advanced-count-value")?.textContent === "3 Unicode 标量"'), 'document edits refresh the advanced count');
    await client.key('ArrowLeft', 'ArrowLeft', 37, 8);
    await waitFor(async () => client.evaluate('document.querySelector("#advanced-count-value")?.textContent === "1 Unicode 标量" && document.querySelector("#advanced-count-scope")?.textContent === "当前选区"'), 'nonempty selection is counted instead of the whole document');
    await client.key('i', 'KeyI', 73, 5);
    await waitFor(async () => client.evaluate('!document.querySelector("#character-panel").classList.contains("hidden") && document.querySelector("#character-details").textContent.includes("LATIN CAPITAL LETTER B") && document.querySelector("#character-details").textContent.includes("Basic Latin") && document.querySelector("#character-details").textContent.includes("大写字母")'), 'selected-character popover exposes Unicode name, block and category');
    await client.evaluate('document.querySelector("#advanced-count-options").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#character-count-dialog").open'), 'advanced count options reopen');
    await client.evaluate(`(() => { const unit = document.querySelector('#count-unit'); unit.value = 'byte'; unit.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate('!document.querySelector("#count-encoding-row").classList.contains("hidden")'), 'byte encoding option appears for byte unit');
    await client.evaluate(`(() => { document.querySelector('#count-encoding').value = 'utf8'; document.querySelector('#character-count-apply').click(); return true; })()`);
    await waitFor(async () => client.evaluate('document.querySelector("#advanced-count-value")?.textContent === "1 字节"'), 'selected UTF-8 byte count uses the Electron codec');
    await client.evaluate('document.querySelector("#advanced-count-stop").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#advanced-character-counter").classList.contains("hidden")'), 'advanced character counter stops cleanly');

    const remotePort = await findAvailableLoopbackPort();
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#settings-popover").classList.contains("hidden")'), 'settings reopen for remote editing');
    await client.evaluate('document.querySelector("#remote-editing-open").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#remote-editing-dialog").open'), 'remote integration settings reopen');
    await client.evaluate(`(() => { document.querySelector('#remote-editing-enabled').checked = true; document.querySelector('#remote-editing-port').value = ${remotePort}; document.querySelector('#remote-editing-form').requestSubmit(); return true; })()`);
    await waitFor(async () => client.evaluate(`document.querySelector('#remote-editing-status').textContent.includes('已启用；仅监听 127.0.0.1:${remotePort}')`), 'loopback RMate listener starts from the settings UI');
    await client.evaluate('document.querySelector("#remote-editing-dialog").close(); true');
    await waitFor(async () => client.evaluate('!document.querySelector("#remote-editing-dialog").open'), 'remote integration dialog closes before opening a document');

    let remoteTraffic = Buffer.alloc(0);
    remoteSocket = net.createConnection({ host: '127.0.0.1', port: remotePort });
    remoteSocket.on('data', chunk => { remoteTraffic = Buffer.concat([remoteTraffic, chunk]); });
    await new Promise((resolve, reject) => {
      remoteSocket.once('connect', resolve);
      remoteSocket.once('error', reject);
    });
    await waitFor(() => remoteTraffic.includes(Buffer.from('CotEdit rmate 1\n')), 'RMate server greeting in Electron').catch(async error => {
      const status = await client.evaluate('document.querySelector("#remote-editing-status").textContent').catch(() => 'unavailable');
      throw new Error(`${error.message}; socket=${remoteSocket.remoteAddress}:${remoteSocket.remotePort} local=${remoteSocket.localAddress}:${remoteSocket.localPort} bytes=${remoteTraffic.length} status=${status}`);
    });
    const remoteToken = `ui-smoke-${Date.now()}`;
    const remoteBody = Buffer.from('remote row one\nremote row two ✓\n', 'utf8');
    remoteSocket.write(rmateOpenFrame({ token: remoteToken, displayName: 'rmate-smoke.py', realPath: '/srv/cotedit/rmate-smoke.py', fileType: 'Python', line: 2, data: remoteBody }));
    await waitFor(async () => client.evaluate('document.querySelector("#active-filename").textContent === "rmate-smoke.py" && document.querySelector("#editor .cm-content").textContent.includes("remote row two ✓")'), 'RMate TCP open reaches the renderer as a document');
    const remoteDocument = JSON.parse(await client.evaluate(`JSON.stringify({language:document.querySelector('#language-select').value,path:document.querySelector('#file-path').textContent,cursor:document.querySelector('#cursor-position').textContent,lines:[...document.querySelectorAll('#editor .cm-line')].map(line=>line.textContent).slice(0,2)})`));
    assert.deepEqual(remoteDocument, { language: 'python', path: '远程文稿 · /srv/cotedit/rmate-smoke.py', cursor: '行 2，列 1', lines: ['remote row one', 'remote row two ✓'] });
    await client.send('Input.insertText', { text: 'local edit ' });
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-content").textContent.includes("local edit ")'), 'remote document accepts local editing');
    await client.evaluate('document.querySelector("#save-file").click(); true');
    await waitFor(() => remoteTraffic.includes(Buffer.from('save\n')) && remoteTraffic.includes(Buffer.from('local edit ')), 'Save button sends changed text back over the RMate socket');
    remoteSocket.end();
    await waitFor(async () => client.evaluate('document.querySelector("#file-path").textContent.includes("连接已断开")'), 'remote disconnect updates document status');
    assert.equal(await client.evaluate('!document.querySelector("dialog[open]")'), true, 'a clean remote disconnect does not interrupt the editor with a modal prompt');

  } catch (error) {
    const state = await client?.evaluate(`JSON.stringify({version:document.querySelector('#app-version')?.textContent,tabCount:document.querySelectorAll('#tabs [role=tab]').length,activeTab:document.querySelector('#tabs [role=tab][aria-selected="true"]')?.outerHTML,editorRole:document.querySelector('#editor')?.getAttribute('role'),editorLabel:document.querySelector('#editor')?.getAttribute('aria-labelledby'),searchExpanded:document.querySelector('#find-button')?.getAttribute('aria-expanded'),searchHidden:document.querySelector('#search-panel')?.classList.contains('hidden'),focused:document.activeElement?.outerHTML.slice(0,160),focusMatchesEditor:document.activeElement?.matches('.cm-content[role=textbox]'),syntaxDialogOpen:document.querySelector('#syntax-menu-dialog')?.open,syntaxHidden:JSON.parse(localStorage.getItem('cotedit.settings.v1')||'{}').hiddenSyntaxes,syntaxSelectorOptions:[...document.querySelectorAll('#language-select option')].map(option=>option.value),mappingDialogOpen:document.querySelector('#syntax-mapping-conflicts-dialog')?.open,cmEditor:document.querySelector('.cm-editor')?.outerHTML.slice(0,500),cmContent:document.querySelector('.cm-content')?.outerHTML.slice(0,300),welcomeHidden:document.querySelector('#welcome')?.classList.contains('hidden')})`).catch(() => 'unavailable');
    if (state) error.message += `\nRenderer DOM state: ${state}`;
    if (stderr) error.message += `\nElectron stderr:\n${stderr}`;
    throw error;
  }
});

test('Electron Quick Actions and file drops preserve menu behavior and support bounded opt-in file content', { timeout: uiTimeoutMs }, async t => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'cotedit-quick-actions-test-'));
  const child = spawn(electronExecutable, [
    applicationEntry, '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${userData}`
  ], { cwd: projectRoot, env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', COTEDIT_TEST_USER_DATA_DIR: userData }, stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32' });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-5000); });
  let client;
  t.after(async () => {
    client?.close();
    signalProcessTree(child, 'SIGTERM');
    await Promise.race([
      child.exitCode === null ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve(),
      delay(2500)
    ]);
    signalProcessTree(child, 'SIGKILL');
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(500)]);
    await rm(userData, { recursive: true, force: true });
  });

  let port;
  try {
    const portFile = path.join(userData, 'DevToolsActivePort');
    await waitFor(async () => {
      try {
        const value = (await readFile(portFile, 'utf8')).split('\n')[0];
        if (/^\d+$/.test(value)) { port = value; return true; }
      } catch {}
      if (child.exitCode !== null) throw new Error(`Electron exited with ${child.exitCode}: ${stderr}`);
      return false;
    }, 'Quick Actions Electron DevTools port', 30000);
    const target = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        return (await response.json()).find(page => page.type === 'page') || false;
      } catch { return false; }
    }, 'Quick Actions Electron page target');
    assert.ok(target.webSocketDebuggerUrl, `Missing DevTools target URL: ${JSON.stringify(target)}`);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    client = new DevToolsClient(socket);
    await waitFor(async () => client.evaluate('document.readyState === "interactive" || document.readyState === "complete"'), 'Quick Actions renderer readiness');
    const usesMeta = await client.evaluate(`(() => { const platform = window.cotedit?.platform || navigator.platform; return platform === 'darwin' || /Mac/i.test(String(platform)); })()`);
    const commandModifier = usesMeta ? 4 : 2;
    await waitFor(async () => client.evaluate(`document.querySelector("#app-version")?.textContent === ${JSON.stringify(applicationVersion)}`), 'Quick Actions app modules');
    await inspectAccessibleControls(client, 'Quick Actions dialog trigger window', [
      { role: 'textbox', name: '文本编辑器：未命名.txt' },
      { role: 'tab', name: '未命名.txt' }
    ]);
    assert.equal(await client.evaluate('typeof window.cotedit?.onFileDrop'), 'function', 'the desktop preload exposes the file-drop listener');
    assert.equal(await client.evaluate('typeof window.cotedit?.formatDroppedFilePaths'), 'function', 'the desktop preload exposes the bounded formatter');

    const droppedFilePath = path.join(userData, 'dragged-reference.txt');
    const droppedFileSecret = 'MUST_NOT_BE_READ_FROM_DROPPED_FILE';
    await writeFile(droppedFilePath, droppedFileSecret, 'utf8');
    await client.evaluate(`(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'file-drop-ui-test'; input.style.display = 'none'; document.body.append(input); return true; })()`);
    const domRoot = await client.send('DOM.getDocument', { depth: -1 });
    const fileInputNode = await client.send('DOM.querySelector', { nodeId: domRoot.root.nodeId, selector: '#file-drop-ui-test' });
    await client.send('DOM.setFileInputFiles', { nodeId: fileInputNode.nodeId, files: [droppedFilePath] });
    const dropWasHandled = await client.evaluate(`(() => {
      const file = document.querySelector('#file-drop-ui-test').files[0];
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const editor = document.querySelector('#editor .cm-content');
      const rect = editor.getBoundingClientRect();
      const x = rect.left + Math.min(24, rect.width / 2);
      const y = rect.top + Math.min(12, rect.height / 2);
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: x, clientY: y });
      editor.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert.equal(dropWasHandled, true, 'the Electron file-drop listener prevents Chromium from navigating/opening the dropped file');
    await waitFor(async () => client.evaluate(`document.querySelector('#editor .cm-content').textContent.includes(${JSON.stringify(droppedFilePath)})`), 'file drop inserts a path reference');
    assert.equal(await client.evaluate(`document.querySelector('#editor .cm-content').textContent.includes(${JSON.stringify(droppedFileSecret)})`), false, 'file drop never reads or inserts the dropped file contents');
    const fileDropUndoModifier = await client.evaluate(`window.cotedit?.platform === 'darwin' ? 4 : 2`);
    await client.key('z', 'KeyZ', 90, fileDropUndoModifier);
    await waitFor(async () => client.evaluate(`!document.querySelector('#editor .cm-content').textContent.includes(${JSON.stringify(droppedFilePath)})`), 'file drop is one undoable editor transaction');

    await client.click('#settings-toggle');
    await waitFor(async () => client.evaluate('document.querySelector("#settings-popover").getAttribute("aria-hidden") === "false"'), 'open editor settings for File Drop rules');
    await client.evaluate(`(() => { window.__fileDropUiErrors = []; window.addEventListener('error', event => window.__fileDropUiErrors.push(event.message)); return true; })()`);
    await client.evaluate('document.querySelector("#file-drop-settings-open").scrollIntoView({block:"center"}); true');
    await client.evaluate('document.querySelector("#file-drop-settings-open").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#file-drop-settings-dialog").open'), 'open the File Drop settings dialog');
    await inspectAccessibleControls(client, 'File Drop settings dialog', [
      { role: 'dialog', name: '文件拖放' },
      { role: 'button', name: '新建规则' },
      { role: 'combobox', name: '适用语法' }
    ]);
    assert.equal(await client.evaluate('document.querySelectorAll("#file-drop-rule-list [role=option]").length'), 6, 'the ordered list starts with the six shipped default rules');
    await waitFor(async () => client.evaluate('document.activeElement.id === "file-drop-rule-list"'), 'File Drop manager initially focuses the ordered rules');
    await client.key('ArrowDown', 'ArrowDown', 40);
    await waitFor(async () => client.evaluate('document.querySelector("#file-drop-rule-list").getAttribute("aria-activedescendant") === "file-drop-rule-option-1"'), 'File Drop rules navigate with the Down arrow');
    await client.click('#file-drop-rule-new');
    await client.evaluate(`(() => {
      const set = (id, value) => { const input = document.querySelector(id); input.value = value; input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); };
      set('#file-drop-rule-scope', '');
      set('#file-drop-rule-extensions', 'txt');
      set('#file-drop-rule-description', 'UI smoke custom rule');
      set('#file-drop-rule-format', 'custom: <<<FILENAME>>>|');
      const format = document.querySelector('#file-drop-rule-format');
      format.focus();
      format.setSelectionRange(format.value.length, format.value.length);
      return true;
    })()`);
    assert.equal(await client.evaluate('Boolean(document.querySelector(\'#file-drop-variable-buttons [data-file-drop-variable="FILECONTENT"]\'))'), true, 'the settings dialog offers FILECONTENT in its variable picker');
    for (const variable of ['IMAGEWIDTH', 'IMAGEHEIGHT']) {
      assert.equal(await client.evaluate(`Boolean(document.querySelector('#file-drop-variable-buttons [data-file-drop-variable="${variable}"]'))`), true, `the settings dialog offers ${variable} in its variable picker`);
    }
    await client.click('#file-drop-variable-buttons [data-file-drop-variable="FILECONTENT"]');
    assert.equal(await client.evaluate('document.querySelector("#file-drop-rule-format").value.endsWith("<<<FILECONTENT>>>")'), true, 'the FILECONTENT picker inserts the token at the text caret');
    await client.click('#file-drop-rule-save');
    await waitFor(async () => client.evaluate(`JSON.parse(localStorage.getItem('cotedit.settings.v1')).fileDropRules.some(rule => rule.description === 'UI smoke custom rule' && rule.extensions.includes('txt'))`), 'persist the custom File Drop rule');
    await client.click('#file-drop-settings-close');
    await waitFor(async () => client.evaluate('!document.querySelector("#file-drop-settings-dialog").open'), 'close the saved File Drop manager');
    await waitFor(async () => client.evaluate('document.activeElement.id === "settings-toggle"'), 'restore focus after File Drop manager closes');

    const customDropPath = path.join(userData, 'custom-file-drop.txt');
    const customDropContent = 'CUSTOM_DROP_CONTENT_EXPLICITLY_REQUESTED';
    await writeFile(customDropPath, customDropContent, 'utf8');
    await client.send('Page.bringToFront');
    await client.evaluate('window.focus(); true');
    await client.send('DOM.setFileInputFiles', { nodeId: fileInputNode.nodeId, files: [customDropPath] });
    await client.evaluate(`(() => {
      const file = document.querySelector('#file-drop-ui-test').files[0];
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const editor = document.querySelector('#editor .cm-content');
      const rect = editor.getBoundingClientRect();
      editor.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.left + 24, clientY: rect.top + 12 }));
      return true;
    })()`);
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-content").textContent.includes("custom: custom-file-drop.txt|")'), 'custom File Drop template formats a live Electron drop');
    assert.equal(await client.evaluate(`document.querySelector('#editor .cm-content').textContent.includes(${JSON.stringify(customDropContent)})`), true, 'FILECONTENT reads and inserts the body only when the matching rule explicitly requests it');
    await waitFor(async () => client.evaluate('document.activeElement.closest("#editor") !== null'), 'file drop focuses the target editor before editing continues');
    await client.key('z', 'KeyZ', 90, fileDropUndoModifier);
    await waitFor(async () => client.evaluate('!document.querySelector("#editor .cm-content").textContent.includes("custom: custom-file-drop.txt")'), 'custom File Drop insertion remains one undoable transaction');

    const oversizedDropPath = path.join(userData, 'oversized-file-drop.txt');
    await writeFile(oversizedDropPath, Buffer.alloc(64 * 1024 + 1, 0x78));
    const contentBeforeOversizedDrop = await client.evaluate('document.querySelector("#editor .cm-content").textContent');
    await client.send('DOM.setFileInputFiles', { nodeId: fileInputNode.nodeId, files: [oversizedDropPath] });
    await client.evaluate(`(() => {
      const file = document.querySelector('#file-drop-ui-test').files[0];
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const editor = document.querySelector('#editor .cm-content');
      const rect = editor.getBoundingClientRect();
      editor.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.left + 24, clientY: rect.top + 12 }));
      return true;
    })()`);
    await waitFor(async () => client.evaluate('document.querySelector("#toast").textContent.includes("最多为 64 KiB")'), 'oversized FILECONTENT is rejected with a visible limit');
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), contentBeforeOversizedDrop, 'an oversized body is rejected without partial insertion');

    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#quick-actions-dialog").open'), 'Quick Actions opens with Ctrl-K');
    await inspectAccessibleControls(client, 'Quick Actions dialog', [
      { role: 'dialog', name: '快速操作' },
      { role: 'combobox', name: '搜索操作' }
    ]);
    await client.evaluate(`(() => { const input = document.querySelector('#quick-actions-query'); input.value = '设置'; input.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('.quick-action-option-label')].some(label => label.textContent === '设置…')`), 'native menu-backed Quick Actions search');
    const quickActionResults = await client.evaluate(`JSON.stringify([...document.querySelectorAll('.quick-action-option')].map(option => ({label: option.querySelector('.quick-action-option-label')?.textContent, group: option.querySelector('.quick-action-option-group')?.textContent})))`);
    assert.ok(JSON.parse(quickActionResults).some(item => item.label === '设置…'), `native menu command is discoverable: ${quickActionResults}`);
    await client.key('Enter', 'Enter', 13);
    await waitFor(async () => client.evaluate('!document.querySelector("#quick-actions-dialog").open && document.querySelector("#settings-popover").getAttribute("aria-hidden") === "false"'), 'Quick Actions executes the selected native menu command');
    await client.click('#settings-toggle');
    await waitFor(async () => client.evaluate('document.querySelector("#settings-popover").getAttribute("aria-hidden") === "true" && document.activeElement.id === "settings-toggle"'), 'settings menu closes with its trigger focused');
    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#quick-actions-dialog").open'), 'Quick Actions reopens');
    await client.key('Escape', 'Escape', 27);
    await waitFor(async () => client.evaluate('!document.querySelector("#quick-actions-dialog").open && document.activeElement.id === "settings-toggle"'), 'Quick Actions Escape restores trigger focus');
    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'B' });
    await client.key('ArrowLeft', 'ArrowLeft', 37, 8);
    await client.key('i', 'KeyI', 73, 5);
    await waitFor(async () => client.evaluate('!document.querySelector("#character-panel").classList.contains("hidden") && document.querySelector("#character-details").textContent.includes("LATIN CAPITAL LETTER B")'), 'Quick Actions changes preserve the existing selected-character shortcut');

    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#quick-actions-dialog").open'), 'reopen Quick Actions for the Tab Width command');
    await client.evaluate(`(() => { const input = document.querySelector('#quick-actions-query'); input.value = '制表符宽度 自定义'; input.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('.quick-action-option')].some(option => option.querySelector('.quick-action-option-label')?.textContent === '自定义…' && option.querySelector('.quick-action-option-group')?.textContent.includes('制表符宽度'))`), 'custom Tab Width appears in Quick Actions');
    const customTabAction = JSON.parse(await client.evaluate(`JSON.stringify([...document.querySelectorAll('.quick-action-option')].map(option => ({label:option.querySelector('.quick-action-option-label')?.textContent,group:option.querySelector('.quick-action-option-group')?.textContent})).filter(option => option.label === '自定义…' && option.group?.includes('制表符宽度')))`));
    assert.equal(customTabAction.length, 1, `custom Tab Width command is uniquely searchable: ${JSON.stringify(customTabAction)}`);
    await client.key('Enter', 'Enter', 13);
    await waitFor(async () => client.evaluate('document.querySelector("#custom-width-dialog").open && document.querySelector("#custom-width-title").textContent === "自定义 Tab 宽度"'), 'custom Tab Width dialog opens from its native menu command');
    await inspectAccessibleControls(client, 'custom Tab Width dialog', [
      { role: 'dialog', name: '自定义 Tab 宽度' },
      { role: 'spinbutton', name: 'Tab 显示列数' }
    ]);
    const storedSettingsBeforeInvalidWidth = await client.evaluate('localStorage.getItem("cotedit.settings.v1")');
    await client.evaluate(`(() => { document.querySelector('#custom-width-value').value = '100'; document.querySelector('#custom-width-form').requestSubmit(); return true; })()`);
    await waitFor(async () => client.evaluate('document.querySelector("#custom-width-dialog").open && document.querySelector("#custom-width-status").textContent.includes("1–99")'), 'custom Tab Width rejects out-of-range values');
    assert.equal(await client.evaluate('localStorage.getItem("cotedit.settings.v1")'), storedSettingsBeforeInvalidWidth, 'an invalid width does not change persisted settings');
    await client.evaluate(`(() => { document.querySelector('#custom-width-value').value = '6'; document.querySelector('#custom-width-form').requestSubmit(); return true; })()`);
    await waitFor(async () => client.evaluate('!document.querySelector("#custom-width-dialog").open && JSON.parse(localStorage.getItem("cotedit.settings.v1")).tabWidth === 6 && document.querySelector("#editor .cm-content").style.tabSize === "6"'), 'custom Tab Width persists and updates the live editor independently');
    assert.equal(await client.evaluate('document.activeElement.matches(".cm-content")'), true, 'applying a custom Tab Width restores editor focus');

    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#quick-actions-dialog").open'), 'open Quick Actions for the per-syntax indentation command');
    await client.evaluate(`(() => { const input = document.querySelector('#quick-actions-query'); input.value = '当前语法的缩进宽度 自定义'; input.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('.quick-action-option')].some(option => option.querySelector('.quick-action-option-label')?.textContent === '自定义…' && option.querySelector('.quick-action-option-group')?.textContent.includes('当前语法的缩进宽度'))`), 'custom per-syntax indentation appears in Quick Actions');
    await client.key('Enter', 'Enter', 13);
    await waitFor(async () => client.evaluate('document.querySelector("#custom-width-dialog").open && document.querySelector("#custom-width-title").textContent === "自定义当前语法缩进宽度"'), 'per-syntax custom indentation dialog opens');
    await client.evaluate(`(() => { document.querySelector('#custom-width-value').value = '5'; document.querySelector('#custom-width-form').requestSubmit(); return true; })()`);
    await waitFor(async () => client.evaluate('!document.querySelector("#custom-width-dialog").open && JSON.parse(localStorage.getItem("cotedit.settings.v1")).indentByLanguage.plaintext === "5" && JSON.parse(localStorage.getItem("cotedit.settings.v1")).tabWidth === 6'), 'custom indentation persists separately from Tab Width');
    await waitFor(async () => client.evaluate('document.activeElement.matches(".cm-content")'), 'custom indentation dialog restores focus to the editor');
    await client.key('End', 'End', 35);
    await client.key('Enter', 'Enter', 13);
    await client.key('Tab', 'Tab', 9);
    const tabInsertionDiagnostics = await client.evaluate(`JSON.stringify({text:document.querySelector('#editor .cm-content').textContent,focus:document.activeElement?.outerHTML?.slice(0,100),tabSize:document.querySelector('#editor .cm-content').style.tabSize,settings:JSON.parse(localStorage.getItem('cotedit.settings.v1'))})`);
    assert.equal(await client.evaluate(`(() => { const lines = [...document.querySelectorAll('#editor .cm-line')]; return lines.length >= 2 && lines.at(-1).textContent === '     '; })()`), true, `Tab inserts five spaces while display width stays six; ${tabInsertionDiagnostics}`);

    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.key('a', 'KeyA', 65, commandModifier);
    await client.send('Input.insertText', { text: 'old new' });
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-content").textContent === "old new"'), 'replace test text enters the editor');
    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#quick-actions-dialog").open'), 'Quick Actions opens for Multiple Replace');
    await client.evaluate(`(() => { const input = document.querySelector('#quick-actions-query'); input.value = '多重替换'; input.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('.quick-action-option-label')].some(label => label.textContent === '管理多重替换…')`), 'Multiple Replace is searchable from the native menu');
    await client.key('Enter', 'Enter', 13);
    await waitFor(async () => client.evaluate('document.querySelector("#multiple-replace-dialog").open'), 'Multiple Replace manager opens from its menu command');
    await inspectAccessibleControls(client, 'Multiple Replace manager', [
      { role: 'dialog', name: '多重替换' },
      { role: 'textbox', name: '定义名称' },
      { role: 'checkbox', name: '仅在当前选区中替换' },
      { role: 'button', name: '添加替换规则' },
      { role: 'button', name: '高亮' },
      { role: 'button', name: '执行全部' }
    ]);
    await client.evaluate(`(() => {
      const set = (selector, value) => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('input', {bubbles:true})); };
      set('#multiple-replace-name', 'Ordered replacement');
      set('.multiple-replace-rule:nth-child(1) input[data-multiple-replace-field="findString"]', 'old');
      set('.multiple-replace-rule:nth-child(1) input[data-multiple-replace-field="replacementString"]', 'new');
      document.querySelector('#multiple-replace-add-rule').click();
      set('.multiple-replace-rule:nth-child(2) input[data-multiple-replace-field="findString"]', 'new');
      set('.multiple-replace-rule:nth-child(2) input[data-multiple-replace-field="replacementString"]', 'done');
      for (const id of ['multiple-replace-textual-case-insensitive', 'multiple-replace-textual-literal', 'multiple-replace-regex-case-insensitive', 'multiple-replace-regex-allow-comments-and-whitespace', 'multiple-replace-regex-ignore-metacharacters', 'multiple-replace-regex-dot-matches-line-separators', 'multiple-replace-regex-anchors-match-lines', 'multiple-replace-regex-unix-line-separators', 'multiple-replace-matches-full-word', 'multiple-replace-unescapes-replacement']) {
        const option = document.querySelector('#' + id);
        if (!option.checked) option.click();
      }
      const anchored = document.querySelector('#multiple-replace-textual-anchored');
      anchored.click();
      const anchoredCanBeEnabled = anchored.checked;
      anchored.click();
      if (!anchoredCanBeEnabled || anchored.checked) throw new Error('Textual anchored option did not toggle both ways');
      return true;
    })()`);
    await client.click('#multiple-replace-highlight');
    await waitFor(async () => client.evaluate('document.querySelector("#multiple-replace-status").textContent.includes("已高亮 2 处") && document.querySelectorAll("#editor .cm-multipleReplaceMatch").length === 2'), 'Multiple Replace independently highlights matches in the editor');
    assert.deepEqual(await client.evaluate('[...document.querySelectorAll("#editor .cm-multipleReplaceMatch")].map(match => match.textContent)'), ['old', 'new']);
    assert.equal(await client.evaluate('document.querySelector("#editor .cm-content").textContent'), 'old new', 'highlighting does not modify the document');
    assert.equal(await client.evaluate('document.querySelector("#search-panel").classList.contains("hidden")'), true, 'Multiple Replace highlighting does not open or reuse ordinary Find');
    await client.click('#multiple-replace-apply');
    await waitFor(async () => client.evaluate('document.querySelector("#multiple-replace-status").textContent.includes("完成：3 项替换") && document.querySelector("#editor .cm-content").textContent === "done done" && document.querySelectorAll("#editor .cm-multipleReplaceMatch").length === 0'), 'ordered replacement edits the document and clears stale multiple-replace highlights');
    const multipleReplaceSettings = JSON.parse(await client.evaluate('localStorage.getItem("cotedit.settings.v1")'));
    assert.equal(multipleReplaceSettings.multipleReplaceDefinitions[0].name, 'Ordered replacement');
    assert.deepEqual(multipleReplaceSettings.multipleReplaceDefinitions[0].replacements.map(rule => [rule.findString, rule.replacementString]), [['old', 'new'], ['new', 'done']]);
    for (const option of ['textualCaseInsensitive', 'textualLiteral', 'regexCaseInsensitive', 'regexAllowCommentsAndWhitespace', 'regexIgnoreMetacharacters', 'regexDotMatchesLineSeparators', 'regexAnchorsMatchLines', 'regexUnixLineSeparators', 'matchesFullWord', 'unescapesReplacementString']) {
      assert.equal(multipleReplaceSettings.multipleReplaceDefinitions[0][option], true, `${option} checkbox persists with the definition`);
    }
    assert.equal(multipleReplaceSettings.multipleReplaceDefinitions[0].textualAnchored, undefined, 'the textual anchored option can be turned back off before saving');
    await client.click('#multiple-replace-close');
    await waitFor(async () => client.evaluate('!document.querySelector("#multiple-replace-dialog").open && document.activeElement.matches(".cm-content")'), 'Multiple Replace closes and restores editor focus');
    await client.key('z', 'KeyZ', 90, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#editor .cm-content").textContent === "old new"'), 'one undo reverses the complete ordered replacement');
  } catch (error) {
    const state = await client?.evaluate(`JSON.stringify({quickActionsOpen:document.querySelector('#quick-actions-dialog')?.open,settingsOpen:document.querySelector('#settings-popover')?.getAttribute('aria-hidden'),fileDropDialogOpen:document.querySelector('#file-drop-settings-dialog')?.open,fileDropButton:document.querySelector('#file-drop-settings-open')?.outerHTML,fileDropErrors:window.__fileDropUiErrors,characterPanel:document.querySelector('#character-panel')?.className,characterDetails:document.querySelector('#character-details')?.textContent,editorText:document.querySelector('#editor .cm-content')?.textContent,browserSelection:getSelection()?.toString(),focused:document.activeElement?.outerHTML.slice(0,160)})`).catch(() => 'unavailable');
    if (state) error.message += `\nQuick Actions renderer state: ${state}`;
    if (stderr) error.message += `\nElectron stderr:\n${stderr}`;
    throw error;
  }
});


test('Electron manages syntax-scoped command snippets and inserts selection/cursor tokens from the native menu', { timeout: uiTimeoutMs }, async t => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'cotedit-snippets-test-'));
  const child = spawn(electronExecutable, [
    applicationEntry, '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${userData}`
  ], { cwd: projectRoot, env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', COTEDIT_TEST_USER_DATA_DIR: userData }, stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32' });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-5000); });
  let client;
  t.after(async () => {
    client?.close();
    signalProcessTree(child, 'SIGTERM');
    await Promise.race([
      child.exitCode === null ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve(),
      delay(2500)
    ]);
    signalProcessTree(child, 'SIGKILL');
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(500)]);
    await rm(userData, { recursive: true, force: true });
  });

  try {
    let port;
    const portFile = path.join(userData, 'DevToolsActivePort');
    await waitFor(async () => {
      try {
        const value = (await readFile(portFile, 'utf8')).split('\n')[0];
        if (/^\d+$/.test(value)) { port = value; return true; }
      } catch {}
      if (child.exitCode !== null) throw new Error(`Electron exited with ${child.exitCode}: ${stderr}`);
      return false;
    }, 'snippet Electron DevTools port', 30000);
    const target = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        return (await response.json()).find(page => page.type === 'page') || false;
      } catch { return false; }
    }, 'snippet Electron page target');
    assert.ok(target.webSocketDebuggerUrl, `Missing DevTools target URL: ${JSON.stringify(target)}`);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    client = new DevToolsClient(socket);
    await waitFor(async () => client.evaluate('document.readyState === "interactive" || document.readyState === "complete"'), 'snippet renderer readiness');
    await waitFor(async () => client.evaluate(`document.querySelector("#app-version")?.textContent === ${JSON.stringify(applicationVersion)}`), 'snippet app modules');
    await inspectAccessibleControls(client, 'snippet settings trigger window', [
      { role: 'textbox', name: '文本编辑器：未命名.txt' },
      { role: 'tab', name: '未命名.txt' }
    ]);

    await client.click('#settings-toggle');
    await waitFor(async () => client.evaluate('document.querySelector("#settings-popover").getAttribute("aria-hidden") === "false"'), 'settings popover opens');
    await client.evaluate('document.querySelector("#snippet-manager-open").scrollIntoView({ block: "center" }); true');
    await client.evaluate('document.querySelector("#snippet-manager-open").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#snippet-manager-dialog").open'), 'snippet manager opens from settings');
    await inspectAccessibleControls(client, 'snippet manager', [
      { role: 'dialog', name: '片段' },
      { role: 'textbox', name: '名称' },
      { role: 'combobox', name: '适用语法' },
      { role: 'button', name: '快捷键' },
      { role: 'textbox', name: '插入内容' },
      { role: 'button', name: '保存' }
    ]);
    await client.click('#snippet-shortcut-record');
    await waitFor(async () => client.evaluate('document.querySelector("#snippet-shortcut-status").textContent.includes("正在录入")'), 'snippet shortcut capture starts');
    const usesMeta = await client.evaluate(`(() => { const platform = window.cotedit?.platform || navigator.platform; return platform === 'darwin' || /Mac/i.test(String(platform)); })()`);
    const commandModifier = usesMeta ? 4 : 2;
    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#snippet-shortcut-status").textContent.includes("快速操作")'), 'conflicting built-in shortcut is rejected');
    await client.key('q', 'KeyQ', 81, commandModifier + 1 + 8);
    await waitFor(async () => client.evaluate('document.querySelector("#snippet-shortcut-record").textContent.toLowerCase().includes("q")'), 'non-conflicting snippet shortcut is recorded');
    await client.evaluate(`(() => {
      const set = (selector, value, eventName = 'input') => { const element = document.querySelector(selector); element.value = value; element.dispatchEvent(new Event(eventName, { bubbles: true })); };
      set('#snippet-name', 'Wrap selection');
      set('#snippet-scope', 'javascript', 'change');
      set('#snippet-format', '<<<<SELECTION>>>>\\n<<<CURSOR>>>');
      document.querySelector('#snippet-manager-form').requestSubmit();
      return true;
    })()`);
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1") || "{}").snippets?.[0]?.name === "Wrap selection"'), 'snippet saves to normalized settings');
    assert.equal(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).snippets[0].scope'), 'javascript', 'syntax scope persists');
    assert.deepEqual(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).snippets[0].shortcut'), { key: 'q', mod: true, ctrl: false, alt: true, shift: true }, 'snippet shortcut is persisted');

    const hiddenMenuEntries = await client.evaluate(`window.cotedit.getQuickActionItems().then(items => items.filter(item => item.label === 'Wrap selection'))`);
    assert.equal(hiddenMenuEntries.length, 0, 'JavaScript-only snippet is absent from the plaintext document menu');
    await client.click('#snippet-manager-close');
    await waitFor(async () => client.evaluate('!document.querySelector("#snippet-manager-dialog").open && document.activeElement.id === "settings-toggle"'), 'manager close restores focus to its settings trigger');
    await client.evaluate(`(() => { const select = document.querySelector('#language-select'); select.value = 'javascript'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await waitFor(async () => client.evaluate('document.querySelector("#language-select").value === "javascript"'), 'active document switches to JavaScript');
    const availableItems = await client.evaluate(`window.cotedit.getQuickActionItems().then(items => items.filter(item => item.label === 'Wrap selection'))`);
    assert.equal(availableItems.length, 1, `JavaScript-scoped snippet is exposed as one native menu command: ${JSON.stringify(availableItems)}`);
    assert.ok(String(availableItems[0].group || '').includes('插入片段'), `snippet appears in the Insert Snippet submenu: ${JSON.stringify(availableItems[0])}`);
    assert.ok(String(availableItems[0].accelerator || '').toLowerCase().includes('q'), `snippet shortcut is exposed in the native menu item: ${JSON.stringify(availableItems[0])}`);

    await client.evaluate('document.querySelector("#editor .cm-content").focus(); true');
    await client.send('Input.insertText', { text: 'abc' });
    await client.key('Home', 'Home', 36);
    await client.key('End', 'End', 35, 8);
    await client.key('k', 'KeyK', 75, commandModifier);
    await waitFor(async () => client.evaluate('document.querySelector("#quick-actions-dialog").open'), 'native menu Quick Actions opens');
    await client.evaluate(`(() => { const input = document.querySelector('#quick-actions-query'); input.value = 'Wrap selection'; input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('.quick-action-option-label')].some(label => label.textContent === 'Wrap selection')`), 'dynamic snippet command is searchable from the native menu');
    await client.key('Enter', 'Enter', 13);
    await waitFor(async () => client.evaluate('!document.querySelector("#quick-actions-dialog").open && [...document.querySelectorAll("#editor .cm-line")].some(line => line.textContent === "<abc>")'), 'snippet replaces selected text and inserts a new line');
    await client.send('Input.insertText', { text: 'z' });
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('#editor .cm-line')].at(-1)?.textContent === 'z'`), 'CURSOR token leaves insertion point after the new line');
    await client.key('q', 'KeyQ', 81, commandModifier + 1 + 8);
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('#editor .cm-line')].some(line => line.textContent === 'z<>')`), 'custom shortcut inserts the configured snippet');
    await client.send('Input.insertText', { text: 'w' });
    await waitFor(async () => client.evaluate(`[...document.querySelectorAll('#editor .cm-line')].at(-1)?.textContent === 'w'`), 'custom shortcut also honors the snippet cursor token');
    assert.equal(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.settings.v1")).snippets.length'), 1, 'snippet remains persisted after insertion');
  } catch (error) {
    const state = await client?.evaluate(`JSON.stringify({managerOpen:document.querySelector('#snippet-manager-dialog')?.open,managerError:document.querySelector('#snippet-manager-error')?.textContent,settings:JSON.parse(localStorage.getItem('cotedit.settings.v1')||'{}').snippets,syntax:document.querySelector('#language-select')?.value,quickActionsOpen:document.querySelector('#quick-actions-dialog')?.open,quickQuery:document.querySelector('#quick-actions-query')?.value,editorLines:[...document.querySelectorAll('#editor .cm-line')].map(line=>line.textContent),focus:document.activeElement?.outerHTML.slice(0,160)})`).catch(() => 'unavailable');
    if (state) error.message += `\nSnippet renderer state: ${state}`;
    if (stderr) error.message += `\nElectron stderr:\n${stderr}`;
    throw error;
  }
});

test('Electron custom editor themes can be selected, renamed, edited, and deleted', { timeout: uiTimeoutMs }, async t => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'cotedit-theme-test-'));
  const child = spawn(electronExecutable, [
    applicationEntry, '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${userData}`
  ], { cwd: projectRoot, env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', COTEDIT_TEST_USER_DATA_DIR: userData }, stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32' });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-5000); });
  let client;
  t.after(async () => {
    client?.close();
    signalProcessTree(child, 'SIGTERM');
    await Promise.race([
      child.exitCode === null ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve(),
      delay(2500)
    ]);
    signalProcessTree(child, 'SIGKILL');
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(500)]);
    await rm(userData, { recursive: true, force: true });
  });

  let port;
  try {
    const portFile = path.join(userData, 'DevToolsActivePort');
    await waitFor(async () => {
      try {
        const value = (await readFile(portFile, 'utf8')).split('\n')[0];
        if (/^\d+$/.test(value)) { port = value; return true; }
      } catch {}
      if (child.exitCode !== null) throw new Error(`Electron exited with ${child.exitCode}: ${stderr}`);
      return false;
    }, 'theme test Electron DevTools port', 30000);
    const target = await waitFor(async () => {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        return pages.find(page => page.type === 'page') || false;
      } catch { return false; }
    }, 'theme test Electron page');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    client = new DevToolsClient(socket);
    await waitFor(async () => client.evaluate(`document.querySelector('#app-version')?.textContent === ${JSON.stringify(applicationVersion)}`), 'theme test renderer readiness');

    const customTheme = {
      format: 'cottheme', name: 'UI Test Theme', styles: {
        text: '#f0f0f0', background: '#202020', selection: '#456789', lineHighlight: '#303030',
        invisibles: '#777777', insertionPoint: '#ffffff', highlight: '#88aa44', keywords: '#cc88ee', strings: '#aaddaa'
      }, metadata: {}, systemSettings: ['selection']
    };
    await client.evaluate(`(() => {
      localStorage.setItem('cotedit.cot-theme.v1', ${JSON.stringify(JSON.stringify(customTheme))});
      localStorage.setItem('cotedit.cot-themes.v1', ${JSON.stringify(JSON.stringify([customTheme]))});
      localStorage.setItem('cotedit.editor-theme-name.v1', 'UI Test Theme');
      location.reload();
      return true;
    })()`);
    await waitFor(async () => client.evaluate(`document.querySelector('#builtin-theme-select')?.value === 'custom:UI Test Theme'`), 'custom theme is loaded into the theme chooser');
    await client.evaluate('document.querySelector("#settings-toggle").click(); true');
    await waitFor(async () => client.evaluate('document.querySelector("#custom-theme-controls")?.hidden === false'), 'custom theme editor is exposed');
    assert.equal(await client.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--editor-theme-background").trim()'), '#202020');

    await client.evaluate(`(() => { const select = document.querySelector('#builtin-theme-select'); select.value = 'builtin:Classic'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    assert.equal(await client.evaluate('localStorage.getItem("cotedit.editor-theme-name.v1")'), 'Classic');
    await client.evaluate(`(() => { const select = document.querySelector('#builtin-theme-select'); select.value = 'custom:UI Test Theme'; select.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    assert.equal(await client.evaluate('localStorage.getItem("cotedit.editor-theme-name.v1")'), 'UI Test Theme');

    await client.evaluate(`(() => { document.querySelector('#custom-theme-name').value = 'Renamed Theme'; document.querySelector('#custom-theme-rename').click(); return true; })()`);
    assert.equal(await client.evaluate('localStorage.getItem("cotedit.editor-theme-name.v1")'), 'Renamed Theme');
    assert.equal(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.cot-themes.v1"))[0].name'), 'Renamed Theme');

    await client.evaluate(`(() => { const input = document.querySelector('[data-theme-style="text"]'); input.value = '#abcdef'; input.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    assert.equal(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.cot-themes.v1"))[0].styles.text'), '#abcdef');
    assert.equal(await client.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--editor-theme-text").trim()'), '#abcdef');
    await client.evaluate(`(() => { const checkbox = document.querySelector('[data-theme-system-role="selection"]'); checkbox.checked = false; checkbox.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    assert.deepEqual(await client.evaluate('JSON.parse(localStorage.getItem("cotedit.cot-themes.v1"))[0].systemSettings'), []);

    await client.evaluate('window.confirm = () => true; document.querySelector("#custom-theme-delete").click(); true');
    await waitFor(async () => client.evaluate('JSON.parse(localStorage.getItem("cotedit.cot-themes.v1")).length === 0'), 'custom theme is deleted');
    assert.equal(await client.evaluate('document.querySelector("#builtin-theme-select").value'), 'builtin:Anura');
    assert.equal(await client.evaluate('document.querySelector("#custom-theme-controls").hidden'), true);
  } catch (error) {
    if (stderr) error.message += `\nElectron stderr:\n${stderr}`;
    throw error;
  }
});
