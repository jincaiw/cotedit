const KEYWORD_COLORS = Object.freeze({
  aqua: [0, 255, 255],
  black: [0, 0, 0],
  blue: [0, 0, 255],
  fuchsia: [255, 0, 255],
  gray: [128, 128, 128],
  green: [0, 128, 0],
  lime: [0, 255, 0],
  maroon: [128, 0, 0],
  navy: [0, 0, 128],
  olive: [128, 128, 0],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  rebeccapurple: [102, 51, 153],
  red: [255, 0, 0],
  silver: [192, 192, 192],
  teal: [0, 128, 128],
  white: [255, 255, 255],
  yellow: [255, 255, 0]
});

export const COLOR_CODE_FORMATS = Object.freeze([
  { id: 'hex', label: 'Hexadecimal' },
  { id: 'hexAlpha', label: 'Hexadecimal with Alpha' },
  { id: 'shortHex', label: 'Hexadecimal (Short)' },
  { id: 'shortHexAlpha', label: 'Hexadecimal with Alpha (Short)' },
  { id: 'rgb', label: 'CSS RGB' },
  { id: 'rgba', label: 'CSS RGBa' },
  { id: 'hsl', label: 'CSS HSL' },
  { id: 'hsla', label: 'CSS HSLa' },
  { id: 'hwb', label: 'CSS HWB' },
  { id: 'hwbAlpha', label: 'CSS HWB with Alpha' },
  { id: 'keyword', label: 'CSS Keyword' }
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hueToRgb(p, q, t) {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function hslToRgb(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)].map(channel => channel * 255);
}

function hwbToRgb(hue, whiteness, blackness) {
  let white = clamp(whiteness, 0, 100) / 100;
  let black = clamp(blackness, 0, 100) / 100;
  if (white + black >= 1) {
    const gray = white / (white + black) * 255;
    return [gray, gray, gray];
  }
  const pure = hslToRgb(hue, 100, 50).map(channel => channel / 255);
  return pure.map(channel => (channel * (1 - white - black) + white) * 255);
}

function parseHue(value) {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(deg|grad|rad|turn)?$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  switch ((match[2] || 'deg').toLowerCase()) {
    case 'turn': return amount * 360;
    case 'grad': return amount * 0.9;
    case 'rad': return amount * 180 / Math.PI;
    default: return amount;
  }
}

function parsePercentage(value) {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))%$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? clamp(amount, 0, 100) : null;
}

function parseChannel(value) {
  const raw = value.trim();
  const percentage = parsePercentage(raw);
  if (percentage !== null) return percentage * 255 / 100;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? clamp(amount, 0, 255) : null;
}

function parseAlpha(value) {
  if (value === undefined) return 1;
  const raw = value.trim();
  const percentage = parsePercentage(raw);
  if (percentage !== null) return percentage / 100;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? clamp(amount, 0, 1) : null;
}

function splitFunctionalArguments(body) {
  const slashParts = body.split('/');
  if (slashParts.length > 2) return null;
  const hasSlashAlpha = slashParts.length === 2;
  const left = slashParts[0].trim();
  let values;
  let alpha;
  if (left.includes(',')) {
    if (hasSlashAlpha) return null;
    values = left.split(',').map(part => part.trim());
    if (values.some(part => part === '')) return null;
    if (values.length === 4) alpha = values.pop();
  } else {
    values = left.split(/\s+/).filter(Boolean);
    if (hasSlashAlpha) alpha = slashParts[1].trim();
  }
  if (values.length !== 3 || (hasSlashAlpha && !alpha)) return null;
  return { values, alpha };
}

function roundByte(value) {
  return Math.round(clamp(value, 0, 255));
}

export function parseColorCode(input) {
  if (typeof input !== 'string') return null;
  const source = input.trim();
  if (!source || source.length > 120) return null;
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(source);
  if (hex) {
    const digits = hex[1];
    const short = digits.length <= 4;
    const expanded = short ? Array.from(digits, digit => digit + digit).join('') : digits;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      format: digits.length === 3 ? 'shortHex' : digits.length === 4 ? 'shortHexAlpha' : digits.length === 8 ? 'hexAlpha' : 'hex',
      uppercase: /[A-F]/.test(digits)
    };
  }
  const keyword = source.toLowerCase();
  if (keyword === 'transparent') return { r: 0, g: 0, b: 0, a: 0, format: 'keyword', uppercase: false };
  if (KEYWORD_COLORS[keyword]) {
    const [r, g, b] = KEYWORD_COLORS[keyword];
    return { r, g, b, a: 1, format: 'keyword', uppercase: false };
  }

  const functionMatch = /^([a-z]+)\((.*)\)$/is.exec(source);
  if (!functionMatch) return null;
  const name = functionMatch[1].toLowerCase();
  const args = splitFunctionalArguments(functionMatch[2]);
  if (!args) return null;
  const alpha = parseAlpha(args.alpha);
  if (alpha === null) return null;
  let rgb;
  let format;
  if (name === 'rgb' || name === 'rgba') {
    const channels = args.values.map(parseChannel);
    if (channels.some(channel => channel === null)) return null;
    rgb = channels;
    format = args.alpha !== undefined || name === 'rgba' ? 'rgba' : 'rgb';
  } else if (name === 'hsl' || name === 'hsla') {
    const hue = parseHue(args.values[0]);
    const saturation = parsePercentage(args.values[1]);
    const lightness = parsePercentage(args.values[2]);
    if (hue === null || saturation === null || lightness === null) return null;
    rgb = hslToRgb(hue, saturation, lightness);
    format = args.alpha !== undefined || name === 'hsla' ? 'hsla' : 'hsl';
  } else if (name === 'hwb') {
    const hue = parseHue(args.values[0]);
    const whiteness = parsePercentage(args.values[1]);
    const blackness = parsePercentage(args.values[2]);
    if (hue === null || whiteness === null || blackness === null) return null;
    rgb = hwbToRgb(hue, whiteness, blackness);
    format = args.alpha !== undefined ? 'hwbAlpha' : 'hwb';
  } else {
    return null;
  }
  return { r: roundByte(rgb[0]), g: roundByte(rgb[1]), b: roundByte(rgb[2]), a: alpha, format, uppercase: false };
}

function normalizeColor(color) {
  if (!color || ![color.r, color.g, color.b, color.a].every(Number.isFinite)) return null;
  return {
    r: roundByte(color.r),
    g: roundByte(color.g),
    b: roundByte(color.b),
    a: clamp(color.a, 0, 1)
  };
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

function trimDecimal(value, places = 2) {
  return Number(value.toFixed(places)).toString();
}

function hexDigits({ r, g, b, a }, includeAlpha, uppercase) {
  const suffix = includeAlpha ? Math.round(a * 255).toString(16).padStart(2, '0') : '';
  const value = [r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('') + suffix;
  return uppercase ? value.toUpperCase() : value;
}

function shortHexDigits(digits) {
  if (Array.from(digits).every((character, index) => index % 2 === 0 ? character === digits[index + 1] : character === digits[index - 1])) {
    return Array.from({ length: digits.length / 2 }, (_, index) => digits[index * 2]).join('');
  }
  return null;
}

function rgbToHwb(color) {
  const hsl = rgbToHsl(color);
  const channels = [color.r, color.g, color.b];
  return { hue: hsl.hue, whiteness: Math.min(...channels) / 255 * 100, blackness: (1 - Math.max(...channels) / 255) * 100 };
}

const REVERSE_KEYWORDS = new Map(Object.entries(KEYWORD_COLORS).map(([name, channels]) => [channels.join(','), name]));

export function formatColorCode(inputColor, format = 'hex', uppercase = false) {
  const color = normalizeColor(inputColor);
  if (!color) return null;
  const hex = `#${hexDigits(color, false, uppercase)}`;
  const hexAlpha = `#${hexDigits(color, true, uppercase)}`;
  switch (format) {
    case 'hex': return hex;
    case 'hexAlpha': return hexAlpha;
    case 'shortHex': return `#${shortHexDigits(hex.slice(1)) || hex.slice(1)}`;
    case 'shortHexAlpha': return `#${shortHexDigits(hexAlpha.slice(1)) || hexAlpha.slice(1)}`;
    case 'rgb': return `rgb(${color.r}, ${color.g}, ${color.b})`;
    case 'rgba': return `rgba(${color.r}, ${color.g}, ${color.b}, ${trimDecimal(color.a, 3)})`;
    case 'hsl': {
      const hsl = rgbToHsl(color);
      return `hsl(${trimDecimal(hsl.hue, 1)}, ${trimDecimal(hsl.saturation, 1)}%, ${trimDecimal(hsl.lightness, 1)}%)`;
    }
    case 'hsla': {
      const hsl = rgbToHsl(color);
      return `hsla(${trimDecimal(hsl.hue, 1)}, ${trimDecimal(hsl.saturation, 1)}%, ${trimDecimal(hsl.lightness, 1)}%, ${trimDecimal(color.a, 3)})`;
    }
    case 'hwb': {
      const hwb = rgbToHwb(color);
      return `hwb(${trimDecimal(hwb.hue, 1)} ${trimDecimal(hwb.whiteness, 1)}% ${trimDecimal(hwb.blackness, 1)}%)`;
    }
    case 'hwbAlpha': {
      const hwb = rgbToHwb(color);
      return `hwb(${trimDecimal(hwb.hue, 1)} ${trimDecimal(hwb.whiteness, 1)}% ${trimDecimal(hwb.blackness, 1)}% / ${trimDecimal(color.a, 3)})`;
    }
    case 'keyword':
      if (color.a === 0) return 'transparent';
      return REVERSE_KEYWORDS.get([color.r, color.g, color.b].join(',')) || (color.a < 1 ? hexAlpha : hex);
    default: return null;
  }
}

export function colorPickerHex(color) {
  const normalized = normalizeColor(color);
  return normalized ? `#${hexDigits(normalized, false, false)}` : null;
}

export function withColorAlpha(color, alpha) {
  const normalized = normalizeColor(color);
  if (!normalized || !Number.isFinite(alpha)) return null;
  return { ...normalized, a: clamp(alpha, 0, 1) };
}
