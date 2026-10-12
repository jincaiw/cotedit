import { Decoration, ViewPlugin } from '@codemirror/view';

const WEB_URL_PATTERN = /https?:\/\/[^\s<>"'`]+/giu;
const TRAILING_PUNCTUATION = /[.,!?;:，。！？；、]$/u;
const MAX_SCAN_CHARS = 512 * 1024;
const MAX_VISIBLE_LINKS = 250;
const MAX_URL_LENGTH = 4096;

function trimPunctuation(value) {
  let end = value.length;
  while (end > 0 && TRAILING_PUNCTUATION.test(value[end - 1])) end--;

  const counts = { '(': 0, ')': 0, '[': 0, ']': 0, '{': 0, '}': 0 };
  for (let index = 0; index < end; index++) {
    const character = value[index];
    if (Object.hasOwn(counts, character)) counts[character]++;
  }
  for (const [closing, opening] of [[')', '('], [']', '['], ['}', '{']]) {
    while (end > 0 && value[end - 1] === closing && counts[closing] > counts[opening]) {
      counts[closing]--;
      end--;
    }
  }
  return end;
}

function isOpenableWebUrl(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

/** Find bounded HTTP(S) links while keeping the original text offsets. */
export function findWebUrlRanges(text, options = {}) {
  if (typeof text !== 'string' || !text) return [];
  const baseOffset = Number.isSafeInteger(options.baseOffset) && options.baseOffset >= 0 ? options.baseOffset : 0;
  const maxScanChars = Number.isSafeInteger(options.maxScanChars)
    ? Math.max(0, Math.min(MAX_SCAN_CHARS, options.maxScanChars))
    : MAX_SCAN_CHARS;
  const maximum = Number.isSafeInteger(options.limit)
    ? Math.max(0, Math.min(MAX_VISIBLE_LINKS, options.limit))
    : MAX_VISIBLE_LINKS;
  if (!maxScanChars || !maximum) return [];

  const scannedText = text.slice(0, maxScanChars);
  const truncated = options.truncated === true || scannedText.length < text.length;
  const links = [];
  WEB_URL_PATTERN.lastIndex = 0;
  for (const match of scannedText.matchAll(WEB_URL_PATTERN)) {
    const raw = match[0];
    const end = trimPunctuation(raw);
    if (!end || (truncated && match.index + raw.length >= scannedText.length)) continue;
    const url = raw.slice(0, end);
    if (!isOpenableWebUrl(url)) continue;
    links.push({ from: baseOffset + match.index, to: baseOffset + match.index + end, url });
    if (links.length >= maximum) break;
  }
  return links;
}

/** Highlight visible web URLs and open them only on Command/Ctrl-click. */
export function urlLinkExtension(openUrl) {
  if (typeof openUrl !== 'function') return [];

  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) this.decorations = this.buildDecorations(update.view);
    }

    buildDecorations(view) {
      const ranges = [];
      let remaining = MAX_SCAN_CHARS;
      for (const visible of view.visibleRanges) {
        if (remaining <= 0 || ranges.length >= MAX_VISIBLE_LINKS) break;
        const end = Math.min(visible.to, visible.from + remaining);
        const text = view.state.doc.sliceString(visible.from, end);
        const links = findWebUrlRanges(text, {
          baseOffset: visible.from,
          maxScanChars: remaining,
          limit: MAX_VISIBLE_LINKS - ranges.length,
          truncated: end < visible.to
        });
        for (const link of links) {
          ranges.push(Decoration.mark({ class: 'cm-cotedit-url', attributes: { 'data-cotedit-url': link.url } }).range(link.from, link.to));
        }
        remaining -= text.length;
      }
      return Decoration.set(ranges.sort((left, right) => left.from - right.from), true);
    }
  }, {
    decorations: plugin => plugin.decorations,
    eventHandlers: {
      click(event) {
        if ((event.button ?? 0) !== 0 || (!event.metaKey && !event.ctrlKey)) return false;
        const target = event.target?.closest?.('.cm-cotedit-url')
          || event.target?.parentElement?.closest?.('.cm-cotedit-url');
        const url = target?.getAttribute?.('data-cotedit-url');
        if (!isOpenableWebUrl(url)) return false;
        event.preventDefault();
        try {
          const result = openUrl(url);
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch {
          // Opening the system browser is best-effort; the editor text remains untouched.
        }
        return true;
      }
    }
  });
}
