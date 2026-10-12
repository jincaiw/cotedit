export function delimitedSortKeyRange(line = '', delimiter = ',', column = 1) {
  const value = String(line);
  const separator = String(delimiter || ',');
  const position = Number(column);
  if (!separator || !Number.isSafeInteger(position) || position < 1) return null;

  let start = 0;
  for (let field = 1; field < position; field++) {
    const delimiterIndex = value.indexOf(separator, start);
    if (delimiterIndex < 0) return null;
    start = delimiterIndex + separator.length;
  }

  const nextDelimiter = value.indexOf(separator, start);
  const end = nextDelimiter < 0 ? value.length : nextDelimiter;
  const field = value.slice(start, end);
  if (!field.length) return { from: start, to: end };
  if (!field.trim()) return null;

  const leadingWhitespace = field.length - field.trimStart().length;
  const trailingWhitespace = field.length - field.trimEnd().length;
  return { from: start + leadingWhitespace, to: end - trailingWhitespace };
}

export function regexSortKeyRange(regexp, line = '', captureIndex = 0) {
  if (!(regexp instanceof RegExp) || !Number.isSafeInteger(captureIndex) || captureIndex < 0) return null;
  const match = regexp.exec(String(line));
  const range = match?.indices?.[captureIndex];
  if (!Array.isArray(range) || !Number.isInteger(range[0]) || !Number.isInteger(range[1])) return null;
  return { from: range[0], to: range[1] };
}
