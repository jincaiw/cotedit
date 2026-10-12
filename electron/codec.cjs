const iconv = require('iconv-lite');
const chardet = require('chardet');

const LINE_ENDING_PATTERN = /\r\n|\r|\n|\u0085|\u2028|\u2029/g;

function lineEndingLabel(value) {
  return value === '\r\n' ? 'CRLF'
    : value === '\r' ? 'CR'
      : value === '\n' ? 'LF'
        : value === '\u0085' ? 'NEL'
          : value === '\u2028' ? 'LS'
            : value === '\u2029' ? 'PS' : 'LF';
}

function getLineEndings(text = '') {
  return [...String(text).matchAll(LINE_ENDING_PATTERN)].map(match => lineEndingLabel(match[0]));
}

function normalizeLineEndings(text = '') {
  return String(text).replace(LINE_ENDING_PATTERN, '\n');
}

function dominantLineEnding(lineEndings = [], fallback = 'LF') {
  const counts = new Map();
  for (const ending of lineEndings) counts.set(ending, (counts.get(ending) || 0) + 1);
  let dominant = fallback;
  let max = 0;
  for (const ending of lineEndings) {
    const count = counts.get(ending) || 0;
    if (count > max) { dominant = ending; max = count; }
  }
  return dominant;
}

function detectEncoding(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return { encoding: 'utf8', bomBytes: 3, bom: true };
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return { encoding: 'utf16le', bomBytes: 2, bom: true };
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return { encoding: 'utf-16be', bomBytes: 2, bom: true };
  let detected = chardet.detect(buffer);
  if (detected === 'ASCII') detected = 'utf8';
  let validUtf8 = true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { validUtf8 = false; }
  if (!validUtf8 && (!detected || /^(utf-?8|ascii)$/i.test(detected))) {
    const alternative = chardet.analyse(buffer).find(item => !/^(utf-?8|ascii)$/i.test(item.name) && item.confidence >= 20);
    detected = alternative?.name || 'windows-1252';
  }
  const candidates = [detected, detected === 'GB18030' ? 'gbk' : null, detected === 'ISO-8859-1' ? 'windows-1252' : null];
  const encoding = candidates.find(candidate => candidate && iconv.encodingExists(candidate)) || 'utf8';
  return { encoding: String(encoding).toLowerCase().replace(/[_ ]/g, '-'), bomBytes: 0, bom: false };
}

function decodeBuffer(buffer, { allowBinaryText = false } = {}) {
  const info = detectEncoding(buffer);
  const text = iconv.decode(buffer.subarray(info.bomBytes), info.encoding);
  const suspiciousNulls = text.length ? [...text].filter(char => char === '\0').length / text.length : 0;
  if (suspiciousNulls > 0.02 && allowBinaryText !== true) throw new Error('该文件似乎是二进制文件，未作为文本打开。');
  return { text, encoding: info.encoding, bom: info.bom };
}

function normalizeEncoding(value) {
  const aliases = {
    utf8: 'utf8', 'utf-8': 'utf8', utf16le: 'utf16le', 'utf-16le': 'utf16le',
    utf16be: 'utf16-be', 'utf-16be': 'utf16-be', shift_jis: 'shift_jis', 'shift-jis': 'shift_jis',
    gbk: 'gbk', gb2312: 'gbk', gb18030: 'gb18030', big5: 'big5', 'windows-1252': 'windows-1252',
    'iso-8859-1': 'iso-8859-1', latin1: 'latin1'
  };
  const encoding = aliases[String(value || '').toLowerCase()] || String(value || '').toLowerCase();
  if (!iconv.encodingExists(encoding)) throw new Error(`不支持的编码：${value}`);
  return encoding;
}

function encodeText(text, encoding = 'utf8', bom = false) {
  const normalized = normalizeEncoding(encoding);
  const body = iconv.encode(text, normalized);
  if (iconv.decode(body, normalized) !== text) throw new Error(`所选 ${encoding} 编码无法无损表示文稿中的部分字符，请改用 Unicode 编码。`);
  if (!bom) return body;
  let prefix;
  if (normalized === 'utf8') prefix = Buffer.from([0xef, 0xbb, 0xbf]);
  else if (normalized === 'utf16le') prefix = Buffer.from([0xff, 0xfe]);
  else if (normalized === 'utf16-be') prefix = Buffer.from([0xfe, 0xff]);
  else prefix = Buffer.alloc(0);
  return prefix.length ? Buffer.concat([prefix, body]) : body;
}

function findIncompatibleCharacters(text = '', encoding = 'utf8', maxItems = 200) {
  const value = String(text);
  const normalized = normalizeEncoding(encoding);
  try {
    encodeText(value, normalized);
    return { items: [], distinctCount: 0, occurrenceCount: 0, truncated: false };
  } catch { /* Scan individual Unicode scalars to locate exact failures. */ }

  const limit = Number.isInteger(maxItems) ? Math.max(1, Math.min(500, maxItems)) : 200;
  const encodable = new Map();
  const incompatible = new Map();
  let omittedDistinct = 0;
  let occurrenceCount = 0;
  let line = 1;
  let column = 1;
  let previousWasCR = false;
  for (const character of value) {
    let canEncode = encodable.get(character);
    if (canEncode === undefined) {
      try { canEncode = iconv.decode(iconv.encode(character, normalized), normalized) === character; }
      catch { canEncode = false; }
      if (encodable.size >= 8192) encodable.clear();
      encodable.set(character, canEncode);
    }
    if (!canEncode) {
      occurrenceCount++;
      const current = incompatible.get(character);
      if (current) current.occurrences++;
      else if (incompatible.size < limit) {
        const codePoint = character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        incompatible.set(character, { character, codePoint: `U+${codePoint}`, firstLine: line, firstColumn: column, occurrences: 1 });
      } else omittedDistinct++;
    }

    if (character === '\r') { line++; column = 1; previousWasCR = true; }
    else if (character === '\n') { if (!previousWasCR) line++; column = 1; previousWasCR = false; }
    else if (character === '\u0085' || character === '\u2028' || character === '\u2029') { line++; column = 1; previousWasCR = false; }
    else { column++; previousWasCR = false; }
  }
  return { items: [...incompatible.values()], distinctCount: incompatible.size + omittedDistinct, occurrenceCount, truncated: omittedDistinct > 0 };
}

module.exports = { detectEncoding, decodeBuffer, normalizeEncoding, encodeText, findIncompatibleCharacters, getLineEndings, normalizeLineEndings, dominantLineEnding };
