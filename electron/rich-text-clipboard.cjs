'use strict';

const MAX_TEXT_LENGTH = 2_000_000;
const MAX_STYLE_RUNS = 20_000;

function parseColor(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  let channels;
  if (/^#[\da-f]{3}$/i.test(input)) {
    channels = [...input.slice(1)].map(character => parseInt(character + character, 16));
  } else if (/^#[\da-f]{6}$/i.test(input)) {
    channels = [1, 3, 5].map(offset => parseInt(input.slice(offset, offset + 2), 16));
  } else {
    const match = input.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i);
    if (!match) return null;
    channels = match.slice(1, 4).map(Number);
    if (channels.some(channel => channel > 255)) return null;
  }
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeFontFamily(value) {
  if (typeof value !== 'string') return 'monospace';
  const first = value.split(',')[0].trim().replace(/^(["'])(.*)\1$/, '$2');
  return first.length <= 120 && /^[\p{L}\p{N} _.-]+$/u.test(first) ? first : 'monospace';
}

function normalizeStyleRuns(value, length) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STYLE_RUNS).map(run => {
    if (!run || typeof run !== 'object') return null;
    const from = Number.isSafeInteger(run.from) ? Math.max(0, Math.min(length, run.from)) : -1;
    const to = Number.isSafeInteger(run.to) ? Math.max(0, Math.min(length, run.to)) : -1;
    if (from < 0 || to <= from) return null;
    return {
      from,
      to,
      color: parseColor(run.color),
      bold: run.bold === true,
      italic: run.italic === true
    };
  }).filter(Boolean).sort((a, b) => a.from - b.from || a.to - b.to);
}

function segmentsFor(text, runs, baseColor) {
  const segments = [];
  let cursor = 0;
  const append = (from, to, style) => {
    if (to <= from) return;
    const previous = segments.at(-1);
    if (previous && previous.to === from && previous.color === style.color && previous.bold === style.bold && previous.italic === style.italic) {
      previous.to = to;
      return;
    }
    segments.push({ from, to, ...style });
  };
  const baseStyle = { color: baseColor, bold: false, italic: false };
  for (const run of runs) {
    const from = Math.max(cursor, run.from);
    const to = Math.max(from, run.to);
    if (from > cursor) append(cursor, from, baseStyle);
    if (to > from) append(from, to, { color: run.color || baseColor, bold: run.bold, italic: run.italic });
    cursor = Math.max(cursor, to);
  }
  if (cursor < text.length) append(cursor, text.length, baseStyle);
  return segments;
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function escapeRTF(value) {
  let output = '';
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    const character = value[index];
    if (character === '\r') {
      if (value[index + 1] === '\n') index++;
      output += '\\line\n';
    } else if (character === '\n') {
      output += '\\line\n';
    } else if (character === '\t') {
      output += '\\tab ';
    } else if (character === '\\' || character === '{' || character === '}') {
      output += `\\${character}`;
    } else if (code < 0x20 || code === 0x7f) {
      output += `\\u${code > 0x7fff ? code - 0x10000 : code}?`;
    } else if (code <= 0x7e) {
      output += character;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        for (const unit of [code, low]) output += `\\u${unit > 0x7fff ? unit - 0x10000 : unit}?`;
        index++;
      } else {
        output += `\\u${code - 0x10000}?`;
      }
    } else {
      output += `\\u${code > 0x7fff ? code - 0x10000 : code}?`;
    }
  }
  return output;
}

function buildRichTextClipboardFormats(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const text = typeof input.text === 'string' ? input.text : '';
  if (!text || text.length > MAX_TEXT_LENGTH) return null;

  const fontFamily = normalizeFontFamily(input.fontFamily);
  const parsedFontSize = Number(input.fontSize);
  const fontSize = Number.isFinite(parsedFontSize) ? Math.max(6, Math.min(96, parsedFontSize)) : 12;
  const baseColor = parseColor(input.color) || '#000000';
  const runs = normalizeStyleRuns(input.runs, text.length);
  const segments = segmentsFor(text, runs, baseColor);
  const colors = [...new Set([baseColor, ...segments.map(segment => segment.color)])];
  const colorIndex = new Map(colors.map((color, index) => [color, index + 1]));
  const cssFont = fontFamily.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const htmlBody = segments.map(segment => {
    const style = [`color:${segment.color}`];
    if (segment.bold) style.push('font-weight:700');
    if (segment.italic) style.push('font-style:italic');
    return `<span style="${style.join(';')}">${escapeHTML(text.slice(segment.from, segment.to))}</span>`;
  }).join('');
  const html = `<meta charset="utf-8"><pre style="font-family:&quot;${cssFont}&quot;,monospace;font-size:${fontSize}px;color:${baseColor};white-space:pre-wrap;margin:0">${htmlBody}</pre>`;

  const colorTable = colors.map(color => {
    const hex = color.slice(1);
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `\\red${red}\\green${green}\\blue${blue};`;
  }).join('');
  let rtfBody = '';
  for (const segment of segments) {
    rtfBody += `\\cf${colorIndex.get(segment.color)}\\b${segment.bold ? 1 : 0}\\i${segment.italic ? 1 : 0} `;
    rtfBody += escapeRTF(text.slice(segment.from, segment.to));
  }
  const fontForRTF = escapeRTF(fontFamily).replace(/\s+/g, ' ');
  const rtf = `{\\rtf1\\ansi\\deff0\\uc1{\\fonttbl{\\f0\\fmodern ${fontForRTF};}}{\\colortbl;${colorTable}}\\viewkind4\\pard\\f0\\fs${Math.round(fontSize * 2)}\\cf${colorIndex.get(baseColor)} ${rtfBody}\\b0\\i0}`;

  return {
    'text/plain': text,
    'text/html': html,
    'text/rtf': rtf
  };
}

module.exports = { buildRichTextClipboardFormats, parseColor, escapeRTF };
