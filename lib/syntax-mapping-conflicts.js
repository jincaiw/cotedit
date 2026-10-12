const mappingTypes = ['extensions', 'filenames', 'interpreters'];
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function valuesFor(record, key) {
  if (!Array.isArray(record?.[key])) return [];
  return record[key].slice(0, 256).flatMap(value => {
    if (typeof value !== 'string') return [];
    const cleaned = value.trim().slice(0, 128);
    if (!cleaned || /[\u0000-\u001f\u007f]/u.test(cleaned)) return [];
    if (key === 'extensions') {
      const extension = cleaned.replace(/^\.+/u, '').toLowerCase();
      return /^[a-z0-9_+-]+$/iu.test(extension) ? [extension] : [];
    }
    if (key === 'filenames') return [cleaned.toLowerCase()];
    return [cleaned];
  });
}

function makeRecords(customSyntaxes, builtinSyntaxes) {
  const custom = (Array.isArray(customSyntaxes) ? customSyntaxes : []).flatMap(syntax => {
    if (!syntax || typeof syntax.id !== 'string' || !syntax.id) return [];
    return [{ id: syntax.id, name: typeof syntax.name === 'string' && syntax.name ? syntax.name : syntax.id, extensions: valuesFor(syntax, 'extensions'), filenames: valuesFor(syntax, 'filenames'), interpreters: valuesFor(syntax, 'interpreters') }];
  }).sort((a, b) => collator.compare(a.name, b.name));
  const builtin = (Array.isArray(builtinSyntaxes) ? builtinSyntaxes : []).flatMap(syntax => {
    if (!syntax || typeof syntax.id !== 'string' || !syntax.id || typeof syntax.label !== 'string') return [];
    return [{ id: syntax.id, name: syntax.label, extensions: valuesFor(syntax, 'extensions'), filenames: valuesFor(syntax, 'filenames'), interpreters: valuesFor(syntax, 'interpreters') }];
  }).sort((a, b) => collator.compare(a.name, b.name));
  return [...custom, ...builtin];
}

/**
 * Build the overlapping filename/extension/interpreter mappings in the same
 * order used for document detection: user syntaxes first, then bundled ones,
 * both in localized-standard alphabetical order as in CotEditor.
 */
export function findSyntaxMappingConflicts(customSyntaxes = [], builtinSyntaxes = []) {
  const tables = Object.fromEntries(mappingTypes.map(type => [type, new Map()]));
  for (const syntax of makeRecords(customSyntaxes, builtinSyntaxes)) {
    for (const type of mappingTypes) {
      for (const value of new Set(syntax[type])) {
        const names = tables[type].get(value) || [];
        if (!names.some(item => item.id === syntax.id)) names.push({ id: syntax.id, name: syntax.name });
        tables[type].set(value, names);
      }
    }
  }
  return Object.fromEntries(mappingTypes.map(type => [type,
    [...tables[type].entries()]
      .filter(([, syntaxes]) => syntaxes.length > 1)
      .map(([name, syntaxes]) => ({ name, primarySyntax: syntaxes[0].name, duplicatedSyntaxes: syntaxes.slice(1).map(syntax => syntax.name) }))
      .sort((a, b) => collator.compare(a.name, b.name))
  ]));
}

function interpreterFromShebang(content) {
  const firstLine = String(content || '').split(/\r\n|\r|\n/u, 1)[0];
  const match = /^#!\s*(\S+)([^\n]*)/u.exec(firstLine);
  if (!match) return '';
  let executable = match[1].split('/').pop() || '';
  if (executable === 'env') {
    executable = match[2].trim().split(/\s+/u).find(value => value && !value.startsWith('-')) || '';
  }
  return executable;
}

/** Resolve a filename by user syntax mappings, bundled mappings, then the plain-text fallback. */
export function languageForMappedFilename(filename = '', customSyntaxes = [], builtinSyntaxes = [], content = '') {
  const base = String(filename).split(/[\\/]/u).pop() || '';
  const normalizedBase = base.toLowerCase();
  const extension = base.split('.').pop()?.toLowerCase() || '';
  const records = makeRecords(customSyntaxes, builtinSyntaxes);
  const filenameMatch = records.find(syntax => syntax.filenames.includes(normalizedBase));
  if (filenameMatch) return filenameMatch.id;
  const extensionMatch = records.find(syntax => syntax.extensions.includes(extension));
  if (extensionMatch) return extensionMatch.id;
  const interpreter = interpreterFromShebang(content);
  if (interpreter) {
    const interpreterMatch = records.find(syntax => syntax.interpreters.includes(interpreter));
    if (interpreterMatch) return interpreterMatch.id;
  }
  if (String(content).startsWith('<?xml ')) return builtinSyntaxes.find(syntax => syntax.id === 'xml')?.id || 'plaintext';
  return builtinSyntaxes.find(syntax => syntax.id === 'plaintext')?.id || 'plaintext';
}
