import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildRichTextClipboardFormats, parseColor, escapeRTF } = require('../electron/rich-text-clipboard.cjs');

test('builds interoperable plain-text, HTML and RTF clipboard formats with syntax colors', () => {
  const formats = buildRichTextClipboardFormats({
    text: 'const <x> = "ok";', fontFamily: 'DM Mono, monospace', fontSize: 14,
    color: 'rgb(24, 32, 40)',
    runs: [{ from: 0, to: 5, color: 'rgb(160, 20, 20)', bold: true }]
  });
  assert.equal(formats['text/plain'], 'const <x> = "ok";');
  assert.match(formats['text/html'], /<pre style="font-family:&quot;DM Mono&quot;,monospace/);
  assert.match(formats['text/html'], /color:#a01414;font-weight:700">const<\/span>/);
  assert.match(formats['text/html'], /&lt;x&gt;/);
  assert.match(formats['text/rtf'], /\\fonttbl\{\\f0\\fmodern DM Mono;/);
  assert.match(formats['text/rtf'], /\\red160\\green20\\blue20;/);
  assert.match(formats['text/rtf'], /\\cf2\\b1\\i0 const/);
});

test('escapes RTF control characters, line endings, CJK and supplementary Unicode characters', () => {
  assert.equal(escapeRTF('\\{}\tA\r\n中😀'), '\\\\\\{\\}\\tab A\\line\n\\u20013?\\u-10179?\\u-8704?');
  const formats = buildRichTextClipboardFormats({ text: '第一行\n第二行', color: '#abc' });
  assert.equal(formats['text/plain'], '第一行\n第二行');
  assert.match(formats['text/html'], /第一行\n第二行/);
  assert.match(formats['text/rtf'], /\\u31532\?\\u19968\?\\u-30644\?/);
  assert.match(formats['text/rtf'], /\\line\n/);
});

test('sanitizes invalid colors and font names and bounds syntax style runs', () => {
  assert.equal(parseColor('rgb(256, 0, 0)'), null);
  assert.equal(parseColor('#AbC'), '#aabbcc');
  const formats = buildRichTextClipboardFormats({
    text: '<safe>', fontFamily: 'bad;}</style><script>', color: 'url(javascript:alert(1))',
    runs: [{ from: 0, to: 6, color: 'url(javascript:alert(1))' }, { from: 2, to: 99, color: '#123456' }]
  });
  assert.match(formats['text/html'], /font-family:&quot;monospace&quot;,monospace/);
  assert.match(formats['text/html'], /color:#000000/);
  assert.doesNotMatch(formats['text/html'], /javascript:|<script|<\/style/);
  assert.match(formats['text/html'], /&lt;safe&gt;/);
});

test('rejects an empty or over-limit copy and clamps untrusted presentation values', () => {
  assert.equal(buildRichTextClipboardFormats({ text: '' }), null);
  assert.equal(buildRichTextClipboardFormats({ text: 'x'.repeat(2_000_001) }), null);
  const formats = buildRichTextClipboardFormats({ text: 'x', fontSize: 500, color: '#000', runs: [{ from: 0, to: 1, color: '#fff', italic: true }] });
  assert.match(formats['text/html'], /font-size:96px/);
  assert.match(formats['text/rtf'], /\\fs192/);
  assert.match(formats['text/rtf'], /\\i1 x/);
});
