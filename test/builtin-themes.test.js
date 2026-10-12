import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeCotEditorTheme } = require('../electron/cot-theme.cjs');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const builtinThemes = readFileSync(new URL('../src/builtin-themes.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The bundled themes must stay byte-identical to CotEditor 7.1.2
// (CotEditor/Resources/Themes/*.cottheme, Apache License 2.0).
const UPSTREAM_7_1_2_THEMES = [
  'Anura.cottheme',
  'Anura (Dark).cottheme',
  'Classic.cottheme',
  'Classic (Dark).cottheme',
  'Dendrobates.cottheme',
  'Dendrobates (Dark).cottheme',
  'Kawazu.cottheme',
  'Lakritz.cottheme',
  'Mono.cottheme',
  'Note.cottheme',
  'Printen.cottheme',
  'Pulse.cottheme',
  'Resinifictrix.cottheme',
  'Resinifictrix (Dark).cottheme'
];

const themeDirectory = new URL('../lib/themes/', import.meta.url);

test('bundled editor themes match the CotEditor 7.1.2 built-in set', () => {
  const files = readdirSync(themeDirectory).filter(name => name.endsWith('.cottheme'));
  assert.deepEqual([...files].sort(), [...UPSTREAM_7_1_2_THEMES].sort());
});

test('every bundled theme parses with the shared cottheme normalizer', () => {
  for (const name of UPSTREAM_7_1_2_THEMES) {
    const parsed = normalizeCotEditorTheme(JSON.parse(readFileSync(new URL(`${name}`, themeDirectory), 'utf8')), name);
    assert.ok(parsed, `${name} failed to normalize`);
    assert.ok(parsed.styles.text && parsed.styles.background, `${name} lacks text/background colors`);
  }
});

test('Classic (Dark) keeps the exact CotEditor 7.1.2 colors and system-setting flags', () => {
  const theme = normalizeCotEditorTheme(
    JSON.parse(readFileSync(new URL('Classic (Dark).cottheme', themeDirectory), 'utf8')),
    'Classic (Dark)'
  );
  assert.deepEqual(theme.styles, {
    text: '#ffffff',
    background: '#0f0f0f',
    invisibles: '#808080',
    selection: '#a7caff',
    insertionPoint: '#000000',
    lineHighlight: '#25321a99',
    highlight: '#5da810',
    keywords: '#7e92ff',
    commands: '#cd8766',
    types: '#4ad6f2',
    attributes: '#549eff',
    variables: '#6b6b9a',
    values: '#b36b99',
    numbers: '#5454ff',
    strings: '#dd595b',
    characters: '#5454ff',
    comments: '#26823d'
  });
  assert.deepEqual(theme.systemSettings.sort(), ['highlight', 'insertionPoint', 'selection']);
  assert.equal(theme.metadata.author, '1024jp');
});

test('built-in themes ship in the CotEditor order and adapt to the appearance', () => {
  assert.ok(builtinThemes.includes("'Anura',"));
  assert.ok(builtinThemes.includes("'Anura (Dark)',"));
  assert.ok(builtinThemes.includes("'Resinifictrix (Dark)'"));
  assert.ok(renderer.includes("const DEFAULT_EDITOR_THEME_NAME = 'Anura';"));
  assert.ok(renderer.includes('function applyBuiltinEditorTheme(name)'));
  assert.ok(renderer.includes('function resolveEditorThemeNameForAppearance(name, appearance)'));
  assert.ok(renderer.includes('function syncEditorThemeForAppearance(appearance)'));
  assert.ok(renderer.includes('function syncBuiltinThemeSelect()'));
  assert.ok(renderer.includes("$('#builtin-theme-select').addEventListener('change'"));
  assert.ok(index.includes('id="builtin-theme-select"'));
  // The default theme matches CotEditor's DefaultSettings (.theme: "Anura").
  assert.match(renderer, /if \(!customEditorTheme\) applyBuiltinEditorTheme\(resolveEditorThemeNameForAppearance\(DEFAULT_EDITOR_THEME_NAME\)\)/);
});
