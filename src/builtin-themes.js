/**
 * Built-in editor themes, copied verbatim from CotEditor 7.1.2
 * (`CotEditor/Resources/Themes/*.cottheme`, Apache License 2.0).
 *
 * The list order mirrors CotEditor's theme setting names (light base names
 * first, followed by their dark counterparts where available).
 */

const themeModules = import.meta.glob('../lib/themes/*.cottheme', { query: '?raw', import: 'default', eager: true });

const BUILTIN_THEME_ORDER = [
  'Anura',
  'Anura (Dark)',
  'Classic',
  'Classic (Dark)',
  'Dendrobates',
  'Dendrobates (Dark)',
  'Kawazu',
  'Lakritz',
  'Mono',
  'Note',
  'Printen',
  'Pulse',
  'Resinifictrix',
  'Resinifictrix (Dark)'
];

const rawByThemeName = new Map();
for (const [filePath, raw] of Object.entries(themeModules)) {
  const name = filePath.split('/').pop().replace(/\.cottheme$/, '');
  rawByThemeName.set(name, typeof raw === 'string' ? raw : String(raw));
}

const BUILTIN_THEME_NAMES = BUILTIN_THEME_ORDER.filter(name => rawByThemeName.has(name));

export function builtinThemeNames() {
  return [...BUILTIN_THEME_NAMES];
}

export function isBuiltinThemeName(name) {
  return BUILTIN_THEME_NAMES.includes(name);
}

/** Returns the parsed JSON of a bundled theme, or null when unknown. */
export function loadBuiltinTheme(name) {
  const raw = rawByThemeName.get(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
