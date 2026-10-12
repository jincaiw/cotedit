import { normalizeUnicode } from './text-tools.js';

const categoryLabels = {
  Lu: 'Uppercase Letter', Ll: 'Lowercase Letter', Lt: 'Titlecase Letter', Lm: 'Modifier Letter', Lo: 'Other Letter',
  Mn: 'Nonspacing Mark', Mc: 'Spacing Mark', Me: 'Enclosing Mark',
  Nd: 'Decimal Number', Nl: 'Letter Number', No: 'Other Number',
  Pc: 'Connector Punctuation', Pd: 'Dash Punctuation', Ps: 'Open Punctuation', Pe: 'Close Punctuation',
  Pi: 'Initial Punctuation', Pf: 'Final Punctuation', Po: 'Other Punctuation',
  Sm: 'Math Symbol', Sc: 'Currency Symbol', Sk: 'Modifier Symbol', So: 'Other Symbol',
  Zs: 'Space Separator', Zl: 'Line Separator', Zp: 'Paragraph Separator',
  Cc: 'Control', Cf: 'Format', Cs: 'Surrogate', Co: 'Private Use', Cn: 'Unassigned'
};

const hangulLeading = ['G', 'GG', 'N', 'D', 'DD', 'R', 'M', 'B', 'BB', 'S', 'SS', '', 'J', 'JJ', 'C', 'K', 'T', 'P', 'H'];
const hangulVowel = ['A', 'AE', 'YA', 'YAE', 'EO', 'E', 'YEO', 'YE', 'O', 'WA', 'WAE', 'OE', 'YO', 'U', 'WEO', 'WE', 'WI', 'YU', 'EU', 'YI', 'I'];
const hangulTrailing = ['', 'G', 'GG', 'GS', 'N', 'NJ', 'NH', 'D', 'L', 'LG', 'LM', 'LB', 'LS', 'LT', 'LP', 'LH', 'M', 'B', 'BS', 'S', 'SS', 'NG', 'J', 'C', 'K', 'T', 'P', 'H'];
let dataPromise;

async function loadUnicodeData() {
  dataPromise ||= import('./unicode-character-data.json', { with: { type: 'json' } }).then(module => module.default);
  return dataPromise;
}

function findRange(ranges, codePoint) {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const [start, end, value] = ranges[middle];
    if (codePoint < start) high = middle - 1;
    else if (codePoint > end) low = middle + 1;
    else return value;
  }
  return null;
}

function scalarName(codePoint, data) {
  const key = codePoint.toString(16).toUpperCase().padStart(4, '0');
  const explicit = data.names[key];
  if (explicit) return explicit;
  const kind = findRange(data.algorithmicNameRanges, codePoint);
  if (kind === 'cjk') return `CJK UNIFIED IDEOGRAPH-${key}`;
  if (kind === 'tangut') return `TANGUT IDEOGRAPH-${codePoint.toString(16).toUpperCase()}`;
  if (kind === 'hangul') {
    const index = codePoint - 0xAC00;
    if (index < 0 || index >= 11172) return null;
    return `HANGUL SYLLABLE ${hangulLeading[Math.floor(index / 588)]}${hangulVowel[Math.floor((index % 588) / 28)]}${hangulTrailing[index % 28]}`;
  }
  return null;
}

function parseCodePoint(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value !== 'string') return null;
  const scalars = Array.from(value);
  return scalars.length === 1 ? scalars[0].codePointAt(0) : null;
}

/** Return authoritative Unicode 17 metadata for one numeric or single-code-point input. */
export async function getUnicodeScalarInfo(value) {
  const codePoint = parseCodePoint(value);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) return null;
  const data = await loadUnicodeData();
  const categoryCode = findRange(data.categories, codePoint) || 'Cn';
  return {
    codePoint,
    codePointLabel: `U+${codePoint.toString(16).toUpperCase().padStart(codePoint <= 0xFFFF ? 4 : 5, '0')}`,
    name: scalarName(codePoint, data),
    categoryCode,
    categoryName: categoryLabels[categoryCode] || 'Unknown',
    blockName: findRange(data.blocks, codePoint),
    age: findRange(data.ages, codePoint)
  };
}

/** Return metadata for every scalar in a (possibly multi-scalar) grapheme. */
export async function getUnicodeCharacterInfo(text) {
  const scalars = Array.from(String(text ?? ''), character => ({ character, codePoint: character.codePointAt(0) }));
  return Promise.all(scalars.map(async scalar => ({
    ...scalar,
    ...(await getUnicodeScalarInfo(scalar.codePoint))
  })));
}

/** Apply CotEditor's advanced-count preprocessing order to one selected string. */
export function prepareAdvancedCountText(value, options = {}) {
  let text = String(value ?? '');
  if (options.ignoresNewlines === true) text = text.replace(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/gu, '');
  if (options.ignoresWhitespaces === true) text = text.replace(/[\t\p{Zs}]/gu, '');
  if (options.treatsConsecutiveWhitespaceAsSingle === true && (!options.ignoresNewlines || !options.ignoresWhitespaces)) {
    text = text.replace(/[\t\n\f\r\p{Z}]{2,}/gu, ' ');
  }
  const form = options.normalizes === true ? options.normalizationForm : null;
  if (form && ['NFD', 'NFC', 'NFKD', 'NFKC', 'NFKC_CF', 'MODIFIED_NFD', 'MODIFIED_NFC'].includes(form)) {
    text = normalizeUnicode(text, form);
  }
  return text;
}

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

/** Count each supplied selection separately, matching CotEditor's multi-selection semantics. */
export function countAdvancedCharacterStrings(strings, options = {}) {
  const pieces = Array.isArray(strings) ? strings : [strings];
  const preparedStrings = pieces.map(value => prepareAdvancedCountText(value, options));
  const unit = ['grapheme', 'scalar', 'utf16', 'byte'].includes(options.unit) ? options.unit : 'grapheme';
  if (unit === 'byte') return { count: null, unit, preparedStrings, encoding: options.encoding || 'utf8' };
  let count = 0;
  for (const text of preparedStrings) {
    if (unit === 'utf16') count += text.length;
    else if (unit === 'scalar') count += Array.from(text).length;
    else if (graphemeSegmenter) count += Array.from(graphemeSegmenter.segment(text)).length;
    else count += Array.from(text).length;
  }
  return { count, unit, preparedStrings, encoding: options.encoding || 'utf8' };
}
