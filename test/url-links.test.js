import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { findWebUrlRanges, urlLinkExtension } from '../lib/url-links.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js';
import { parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';

const require = createRequire(import.meta.url);
const { normalizeExternalWebUrl } = require('../electron/external-web-url.cjs');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('URL scanning detects bounded HTTP(S) links and excludes prose punctuation', () => {
  const text = 'Read (https://example.test/a_(b))., then http://例え.テスト/页?q=1; ftp://example.test/file';
  const links = findWebUrlRanges(text);
  assert.deepEqual(links.map(link => link.url), [
    'https://example.test/a_(b)',
    'http://例え.テスト/页?q=1'
  ]);
  for (const link of links) assert.equal(text.slice(link.from, link.to), link.url);
});

test('URL scanning skips unsafe, overlong, truncated and over-limit candidates', () => {
  assert.deepEqual(findWebUrlRanges('javascript:alert(1) file:///tmp/a ftp://example.test'), []);
  assert.equal(findWebUrlRanges(`https://${'a'.repeat(4200)}.test`).length, 0);
  assert.deepEqual(findWebUrlRanges(`https://example.test${'.'.repeat(20000)}`).map(link => link.url), ['https://example.test']);
  assert.deepEqual(findWebUrlRanges('https://example.test/partial', { maxScanChars: 12 }), []);
  const links = findWebUrlRanges('https://one.test https://two.test', { limit: 1 });
  assert.deepEqual(links.map(link => link.url), ['https://one.test']);
  assert.ok(urlLinkExtension(() => {}));
  assert.deepEqual(urlLinkExtension(null), []);
});

test('external URL IPC accepts only HTTP(S) URLs without credentials or controls', () => {
  assert.equal(normalizeExternalWebUrl('https://example.test/a?q=1'), 'https://example.test/a?q=1');
  assert.equal(normalizeExternalWebUrl('http://example.test'), 'http://example.test/');
  for (const invalid of [
    'javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.test', '//example.test',
    'https://user:pass@example.test/', 'https://example.test/\nheader', '', null,
    `https://example.test/${'a'.repeat(4200)}`
  ]) assert.equal(normalizeExternalWebUrl(invalid), null, String(invalid));
});

test('URL link preference defaults off, normalizes strictly, and settings files round-trip it', () => {
  assert.equal(DEFAULT_SETTINGS.autoLinkDetection, false);
  assert.equal(normalizeSettings({}).autoLinkDetection, false);
  assert.equal(normalizeSettings({ autoLinkDetection: true }).autoLinkDetection, true);
  assert.equal(normalizeSettings({ autoLinkDetection: 'yes' }).autoLinkDetection, false);
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoLinkDetection: true })).autoLinkDetection, true);
  assert.equal(parseSettingsFile(serializeSettingsFile({ autoLinkDetection: false })).autoLinkDetection, false);
});

test('URL links are accessible in settings, live-reconfigured in all editor views, and opened through a safe main-process bridge', () => {
  assert.match(html, /<label class="setting-row"[^>]*><span>链接文稿中的 URL<\/span><input type="checkbox" id="link-urls-setting" \/><\/label>/);
  assert.match(renderer, /\$\('#link-urls-setting'\)\.checked = settings\.autoLinkDetection/);
  assert.match(renderer, /\$\('#link-urls-setting'\)\.addEventListener\('change', event => \{ settings\.autoLinkDetection = event\.target\.checked; persistSettings\(\); applySettings\(\); \}\)/);
  assert.match(renderer, /urlLinkCompartment\.of\(urlLinksExtension\(\)\)/);
  assert.match(renderer, /urlLinkCompartment\.reconfigure\(urlLinksExtension\(\)\)/);
  assert.match(html, /title="[^"]*Command 或 Control 并单击/);
  assert.match(preload, /openExternalUrl: \(url\) => ipcRenderer\.invoke\('external:open-url', url\)/);
  assert.match(main, /ipcMain\.handle\('external:open-url',[\s\S]*?normalizeExternalWebUrl\(requestedUrl\)[\s\S]*?shell\.openExternal\(url\)/);
  assert.match(styles, /\.cm-cotedit-url\s*\{[^}]*text-decoration: underline/);
});
