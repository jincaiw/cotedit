'use strict';

const PAGE_SIZES = new Set(['A4', 'A3', 'Letter', 'Legal', 'Tabloid']);
const ORIENTATIONS = new Set(['portrait', 'landscape']);
const MARGINS = {
  normal: { vertical: 18, horizontal: 16 },
  narrow: { vertical: 10, horizontal: 10 },
  wide: { vertical: 25, horizontal: 25 }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function normalizePrintSettings(value = {}) {
  const pageSize = PAGE_SIZES.has(value.printPageSize) ? value.printPageSize : 'A4';
  const orientation = ORIENTATIONS.has(value.printOrientation) ? value.printOrientation : 'portrait';
  const margin = MARGINS[value.printMargins] || MARGINS.normal;
  const rawFontFamily = typeof value.fontFamily === 'string' ? value.fontFamily.trim() : '';
  const customFontFamily = rawFontFamily.length <= 80 && /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(rawFontFamily)
    ? rawFontFamily
    : '';
  const fallbackFontFamily = value.fontType === 'standard'
    ? '"DM Sans", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    : '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
  const rawFontSize = Number.isFinite(value.printFontSize) ? Math.round(value.printFontSize) : 10;
  const rawTabWidth = Number.isFinite(value.tabWidth) ? value.tabWidth : 4;
  return {
    pageSize,
    orientation,
    margin,
    ligatures: value.ligatures !== false,
    fontType: value.fontType === 'standard' ? 'standard' : 'monospaced',
    fontFamily: customFontFamily ? `"${customFontFamily}", ${fallbackFontFamily}` : fallbackFontFamily,
    printTitle: value.printTitle !== false,
    printLineNumbers: value.printLineNumbers === true,
    verticalText: value.verticalText === true,
    writingDirection: value.writingDirection === 'rtl' ? 'rtl' : 'ltr',
    printFontSize: Math.max(8, Math.min(18, rawFontSize)),
    tabSize: Math.max(1, Math.min(99, Math.round(rawTabWidth)))
  };
}

function renderNumberedText(text, startLine = 1) {
  const firstLine = Number.isSafeInteger(startLine) && startLine > 0 ? startLine : 1;
  const lines = String(text).split(/\r\n|\r|\n|\u0085|\u2028|\u2029/);
  const rows = lines.map((line, index) => `<div class="print-line"><span class="print-line-number" aria-hidden="true">${firstLine + index}</span><span class="print-line-content">${escapeHtml(line)}</span></div>`).join('');
  return `<div class="print-lines">${rows}</div>`;
}

function buildPrintHTML({ name = 'Untitled.txt', text = '', pageSetup = {}, startLine = 1 } = {}) {
  const safeName = escapeHtml(name);
  const safeText = escapeHtml(text);
  const settings = normalizePrintSettings(pageSetup);
  const heading = settings.printTitle ? `<h1>${safeName}</h1>` : '';
  const source = settings.printLineNumbers ? renderNumberedText(text, startLine) : `<pre>${safeText}</pre>`;
  const classes = [settings.verticalText ? 'vertical-text' : '', settings.writingDirection === 'rtl' ? 'rtl' : ''].filter(Boolean);
  const bodyClass = classes.length ? ` class="${classes.join(' ')}"` : '';
  const bodyDirection = settings.writingDirection === 'rtl' ? ' dir="rtl"' : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeName}</title>
  <style>
    @page { size: ${settings.pageSize} ${settings.orientation}; margin: ${settings.margin.vertical}mm ${settings.margin.horizontal}mm; }
    body { margin: 0; color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body.vertical-text { writing-mode: vertical-rl; text-orientation: mixed; }
    body.rtl { direction: rtl; }
    body.rtl .print-line { direction: rtl; }
    body.rtl .print-line-number { text-align: left; }
    h1 { margin: 0 0 8mm; padding-bottom: 3mm; border-bottom: 1px solid #bbb; font-size: 12pt; font-weight: 600; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: ${settings.tabSize}; font: ${settings.printFontSize}pt/1.45 ${settings.fontFamily}; font-variant-ligatures: ${settings.ligatures ? 'normal' : 'none'}; }
    .print-lines { margin: 0; font: ${settings.printFontSize}pt/1.45 ${settings.fontFamily}; font-variant-ligatures: ${settings.ligatures ? 'normal' : 'none'}; }
    .print-line { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 1em; }
    .print-line-number { color: #666; text-align: right; user-select: none; }
    .print-line-content { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: ${settings.tabSize}; }
    body.vertical-text .print-line { display: flex; flex-direction: row; break-inside: avoid; }
    body.vertical-text .print-line-content { min-width: auto; }
  </style>
</head>
<body${bodyClass}${bodyDirection}>${heading}${source}</body>
</html>`;
}

function printOptions(pageSetup = {}) {
  const settings = normalizePrintSettings(pageSetup);
  const { vertical, horizontal } = settings.margin;
  return {
    pageSize: settings.pageSize,
    landscape: settings.orientation === 'landscape',
    margins: {
      marginType: 'custom',
      top: vertical / 25.4,
      bottom: vertical / 25.4,
      left: horizontal / 25.4,
      right: horizontal / 25.4
    }
  };
}

module.exports = { buildPrintHTML, normalizePrintSettings, printOptions };
