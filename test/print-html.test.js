import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPrintHTML } = require('../electron/print-html.cjs');

test('print page includes the whole document as escaped plain text', () => {
  const html = buildPrintHTML({ name: '<script>alert(1)</script>.txt', text: 'first\n<script>not markup</script>\nlast' });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;\.txt/);
  assert.match(html, /first\n&lt;script&gt;not markup&lt;\/script&gt;\nlast/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /white-space:\s*pre-wrap/);
});

test('print page is valid for empty and non-ASCII documents', () => {
  const html = buildPrintHTML({ name: '备忘录.txt', text: '' });
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<h1>备忘录\.txt<\/h1>/);
  assert.match(html, /<pre><\/pre>/);
});

test('print page applies only allow-listed paper and margin settings', () => {
  const { printOptions } = require('../electron/print-html.cjs');
  const html = buildPrintHTML({ name: 'file.txt', text: 'a\tb', pageSetup: {
    printPageSize: 'Letter', printOrientation: 'landscape', printMargins: 'narrow', printTitle: false,
    printFontSize: 14, indent: '2', tabWidth: 6
  } });
  assert.match(html, /size: Letter landscape; margin: 10mm 10mm/);
  assert.match(html, /tab-size: 6/);
  assert.match(html, /font: 14pt\/1\.45/);
  assert.doesNotMatch(html, /<h1>/);
  assert.deepEqual(printOptions({ printPageSize: 'Letter', printOrientation: 'landscape', printMargins: 'narrow' }), {
    pageSize: 'Letter', landscape: true,
    margins: { marginType: 'custom', top: 10 / 25.4, bottom: 10 / 25.4, left: 10 / 25.4, right: 10 / 25.4 }
  });
});

test('print Tab rendering uses the independent bounded Tab Width setting', () => {
  assert.match(buildPrintHTML({ text: 'a\tb', pageSetup: { indent: '2', tabWidth: 8 } }), /tab-size: 8/);
  assert.match(buildPrintHTML({ text: 'a\tb', pageSetup: { indent: 'tab', tabWidth: 1 } }), /tab-size: 1/);
  assert.match(buildPrintHTML({ text: 'a\tb', pageSetup: { indent: '8', tabWidth: 100 } }), /tab-size: 99/);
  assert.match(buildPrintHTML({ text: 'a\tb', pageSetup: { indent: '8' } }), /tab-size: 4/);
});

test('print CSS honors the explicit ligature preference for plain and numbered text', () => {
  const plain = buildPrintHTML({ text: '-> != ffi', pageSetup: { ligatures: false } });
  assert.match(plain, /font-variant-ligatures: none/);
  const numbered = buildPrintHTML({ text: '-> != ffi', pageSetup: { printLineNumbers: true, ligatures: false } });
  assert.match(numbered, /\.print-lines \{[^}]*font-variant-ligatures: none/s);
  assert.match(buildPrintHTML({ text: 'ffi' }), /font-variant-ligatures: normal/);
});

test('print CSS follows the selected editor font type for plain and numbered text', () => {
  const standard = buildPrintHTML({ text: 'wide i and narrow l', pageSetup: { fontType: 'standard' } });
  assert.match(standard, /font: 10pt\/1\.45 "DM Sans", "Noto Sans SC"[\s\S]*?sans-serif/);
  const numbered = buildPrintHTML({ text: 'wide i and narrow l', pageSetup: { fontType: 'standard', printLineNumbers: true } });
  assert.match(numbered, /\.print-lines \{[^}]*font-family|\.print-lines \{[^}]*font: 10pt\/1\.45 "DM Sans"/s);
  const invalid = buildPrintHTML({ text: 'safe', pageSetup: { fontType: 'monospace; color:red' } });
  assert.match(invalid, /font: 10pt\/1\.45 "SFMono-Regular", Consolas/);
  assert.doesNotMatch(invalid, /color:red/);
});

test('print CSS rejects injected page setup values', () => {
  const html = buildPrintHTML({ pageSetup: { printPageSize: 'A4; } body { display:none', printOrientation: 'portrait; color:red' } });
  assert.match(html, /size: A4 portrait/);
  assert.doesNotMatch(html, /display:none|color:red/);
});

test('optional print line numbers preserve blank lines, Unicode line breaks and escaped source', () => {
  const html = buildPrintHTML({ name: 'lines.txt', text: 'one\r\ntwo\u2028<script>', pageSetup: { printLineNumbers: true } });
  assert.match(html, /class="print-line-number" aria-hidden="true">1<\/span>/);
  assert.match(html, /class="print-line-number" aria-hidden="true">2<\/span>/);
  assert.match(html, /class="print-line-number" aria-hidden="true">3<\/span>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(buildPrintHTML({ text: 'one', pageSetup: { printLineNumbers: false } }), /<body>[\s\S]*class="print-line-number"/);
});

test('printing a selection preserves its original document line numbers', () => {
  const html = buildPrintHTML({ text: 'selected\nnext', startLine: 42, pageSetup: { printLineNumbers: true } });
  assert.match(html, /class="print-line-number" aria-hidden="true">42<\/span>/);
  assert.match(html, /class="print-line-number" aria-hidden="true">43<\/span>/);
  const invalid = buildPrintHTML({ text: 'selected', startLine: 0, pageSetup: { printLineNumbers: true } });
  assert.match(invalid, /class="print-line-number" aria-hidden="true">1<\/span>/);
});

test('RTL print direction places line numbers on the right and keeps line contents bidi-aware', () => {
  const rtl = buildPrintHTML({ text: 'שלום\nעולם', pageSetup: { writingDirection: 'rtl', printLineNumbers: true } });
  assert.match(rtl, /<body class="rtl" dir="rtl">/);
  assert.match(rtl, /body\.rtl \.print-line \{ direction: rtl; \}/);
  assert.match(rtl, /body\.rtl \.print-line-number \{ text-align: left; \}/);
  assert.match(rtl, /class="print-line-number" aria-hidden="true">1<\/span><span class="print-line-content">שלום/);
  assert.match(buildPrintHTML({ text: 'left', pageSetup: { writingDirection: 'unknown', printLineNumbers: true } }), /<body>/);
});

test('vertical text preference prints plain and numbered source in vertical flow', () => {
  const plain = buildPrintHTML({ name: '日记.txt', text: '春\n夏', pageSetup: { verticalText: true } });
  assert.match(plain, /<body class="vertical-text">/);
  assert.match(plain, /body\.vertical-text \{ writing-mode: vertical-rl; text-orientation: mixed; \}/);
  assert.match(plain, /<pre>春\n夏<\/pre>/);

  const numbered = buildPrintHTML({ text: '春\n夏', pageSetup: { verticalText: true, printLineNumbers: true } });
  assert.match(numbered, /body\.vertical-text \.print-line \{ display: flex; flex-direction: row; break-inside: avoid; \}/);
  assert.match(numbered, /class="print-line-number" aria-hidden="true">2<\/span><span class="print-line-content">夏/);

  const horizontal = buildPrintHTML({ text: '春\n夏', pageSetup: { verticalText: false } });
  assert.match(horizontal, /<body>/);
  assert.doesNotMatch(horizontal, /<body class="vertical-text">/);
});
