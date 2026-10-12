export const DEFAULT_SYNTAX_ID = 'plaintext';
export const DEFAULT_SYNTAX_FILE_EXTENSION = 'txt';

const SYNTAX_ID = /^[a-z][a-z0-9_-]{0,80}$/i;
const FILE_EXTENSION = /^[a-z0-9_+-]{1,32}$/i;

export function normalizeDefaultSyntaxId(value) {
  return typeof value === 'string' && SYNTAX_ID.test(value)
    ? value.toLowerCase()
    : DEFAULT_SYNTAX_ID;
}

export function resolveDefaultSyntaxId(value, builtInSyntaxes = [], customSyntaxes = []) {
  const id = normalizeDefaultSyntaxId(value);
  return [...builtInSyntaxes, ...customSyntaxes].some(syntax => syntax?.id?.toLowerCase() === id)
    ? id
    : DEFAULT_SYNTAX_ID;
}

export function defaultSyntaxFileExtension(value, builtInSyntaxes = [], customSyntaxes = []) {
  const id = resolveDefaultSyntaxId(value, builtInSyntaxes, customSyntaxes);
  const syntax = [...builtInSyntaxes, ...customSyntaxes].find(item => item?.id?.toLowerCase() === id);
  const extension = Array.isArray(syntax?.extensions)
    ? syntax.extensions.find(candidate => typeof candidate === 'string' && FILE_EXTENSION.test(candidate))
    : null;
  return extension ? extension.toLowerCase() : DEFAULT_SYNTAX_FILE_EXTENSION;
}
