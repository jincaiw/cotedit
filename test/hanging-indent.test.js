import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/settings.js';
import { parseSettingsFile, serializeSettingsFile } from '../lib/settings-file.js';
import { hangingIndentLineStyle, leadingIndentColumns } from '../lib/hanging-indent.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('leading indentation counts spaces and tab stops, stopping at first content', () => {
  assert.equal(leadingIndentColumns('  item'), 2);
  assert.equal(leadingIndentColumns('  \titem', 4), 4);
  assert.equal(leadingIndentColumns('\t \titem', 4), 8);
  assert.equal(leadingIndentColumns('item  \t'), 0);
  assert.equal(leadingIndentColumns('　item'), 0);
});

test('invalid text and tab widths are handled safely', () => {
  assert.equal(leadingIndentColumns(null), 0);
  assert.equal(leadingIndentColumns('\titem', 0), 1);
  assert.equal(leadingIndentColumns('\titem', 120), 99);
});

test('hanging-indent width adds space columns after the source indentation', () => {
  assert.equal(hangingIndentLineStyle('  item', {
    tabWidth: 4, hangingIndentWidth: 2, spaceWidth: 8, basePadding: 5, contentWidth: 200
  }), 'padding-left:37px;padding-right:0px;text-indent:-32px;');
  assert.equal(hangingIndentLineStyle('item', {
    hangingIndentWidth: 3, spaceWidth: 6, basePadding: 5
  }), 'padding-left:23px;padding-right:0px;text-indent:-18px;');
  assert.equal(hangingIndentLineStyle('item', { spaceWidth: 8 }), null);
});

test('RTL text receives logical right-side continuation indentation', () => {
  assert.equal(hangingIndentLineStyle('\titem', {
    tabWidth: 4, spaceWidth: 7, basePadding: 5, direction: 'rtl'
  }), 'padding-left:0px;padding-right:33px;text-indent:-28px;');
});

test('very narrow content suppresses an indent that would leave no usable line width', () => {
  assert.equal(hangingIndentLineStyle('    item', {
    spaceWidth: 8, basePadding: 5, contentWidth: 40
  }), null);
});

test('CotEditor hanging-indent defaults and imported preferences are normalized and portable', () => {
  assert.equal(DEFAULT_SETTINGS.enablesHangingIndent, true);
  assert.equal(DEFAULT_SETTINGS.hangingIndentWidth, 0);
  assert.equal(normalizeSettings({}).enablesHangingIndent, true);
  assert.equal(normalizeSettings({}).hangingIndentWidth, 0);
  assert.equal(normalizeSettings({ enablesHangingIndent: false }).enablesHangingIndent, false);
  assert.equal(normalizeSettings({ enablesHangingIndent: 'yes' }).enablesHangingIndent, true);
  assert.equal(normalizeSettings({ hangingIndentWidth: 2.6 }).hangingIndentWidth, 3);
  assert.equal(normalizeSettings({ hangingIndentWidth: -4 }).hangingIndentWidth, 0);
  assert.equal(normalizeSettings({ hangingIndentWidth: 120 }).hangingIndentWidth, 99);
  assert.equal(normalizeSettings({ hangingIndentWidth: '8' }).hangingIndentWidth, 0);

  const imported = parseSettingsFile(serializeSettingsFile({ enablesHangingIndent: false, hangingIndentWidth: 6 }));
  assert.equal(imported.enablesHangingIndent, false);
  assert.equal(imported.hangingIndentWidth, 6);
});

test('settings expose accessible controls and reflow only horizontally wrapped lines', () => {
  assert.match(html, /<label class="setting-row" title="启用后，自动换行的续行[^"]*"><span>缩进换行续行<\/span><input type="checkbox" id="hanging-indent-setting" \/><\/label>/);
  assert.match(html, /id="hanging-indent-width" min="0" max="99" step="1"/);
  assert.match(renderer, /const hangingIndentActive = settings\.enablesHangingIndent && settings\.wrap && !settings\.verticalText/);
  assert.match(renderer, /hangingIndentLineStyle\(line\.text, hangingIndentMetrics\)/);
  assert.match(renderer, /data-hanging-indent': 'true'/);
  assert.match(renderer, /\$\('#hanging-indent-width'\)\.disabled = !settings\.enablesHangingIndent/);
  assert.match(renderer, /settings\.hangingIndentWidth = Math\.max\(0, Math\.min\(99, Math\.round\(value\)\)\)/);
});
