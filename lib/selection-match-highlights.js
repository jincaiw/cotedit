import { SearchCursor } from '@codemirror/search';
import { StateEffect } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { DEFAULT_SELECTION_INSTANCE_HIGHLIGHT_DELAY, normalizeSelectionInstanceHighlightDelay } from './selection-highlight-delay.js';

export const MAX_SELECTION_INSTANCE_HIGHLIGHTS = 100;
const refreshSelectionMatchHighlights = StateEffect.define();
const selectionMatchDecoration = Decoration.mark({ class: 'cm-selectionMatch' });

function hasHighlightableSelection(state) {
  const selection = state?.selection;
  return Boolean(selection && selection.ranges.length === 1 && !selection.main.empty
    && selection.main.to - selection.main.from <= 200);
}

/** Return visible non-overlapping matches using CodeMirror's plain-string search semantics. */
export function collectSelectionInstanceMatches(state, visibleRanges, maxMatches = MAX_SELECTION_INSTANCE_HIGHLIGHTS) {
  if (!state?.doc || !state.selection || !Array.isArray(visibleRanges) || !Number.isInteger(maxMatches) || maxMatches < 0) return [];
  if (!hasHighlightableSelection(state)) return [];
  const { main } = state.selection;
  const query = state.sliceDoc(main.from, main.to);
  if (!query) return [];

  const matches = [];
  for (const visible of visibleRanges) {
    if (!Number.isInteger(visible?.from) || !Number.isInteger(visible?.to)) continue;
    const from = Math.max(0, Math.min(state.doc.length, visible.from));
    const to = Math.max(from, Math.min(state.doc.length, visible.to));
    const cursor = new SearchCursor(state.doc, query, from, to);
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      const { from: matchFrom, to: matchTo } = next.value;
      if (matchFrom >= main.to || matchTo <= main.from) {
        matches.push({ from: matchFrom, to: matchTo });
        if (matches.length > maxMatches) return [];
      }
    }
  }
  return matches;
}

/** A trailing-edge callback that can be cancelled when a selection changes or a view is destroyed. */
export function createTrailingDebounce(callback, delayMilliseconds, timers = globalThis) {
  if (typeof callback !== 'function' || typeof timers?.setTimeout !== 'function' || typeof timers?.clearTimeout !== 'function') {
    throw new TypeError('需要有效的回调函数与计时器。');
  }
  let timer = null;
  return {
    schedule() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = null;
        callback();
      }, Math.max(0, delayMilliseconds));
    },
    cancel() {
      if (timer === null) return;
      timers.clearTimeout(timer);
      timer = null;
    },
    get pending() { return timer !== null; }
  };
}

function decorationsFor(view) {
  const matches = collectSelectionInstanceMatches(view.state, view.visibleRanges);
  const ranges = matches.map(match => selectionMatchDecoration.range(match.from, match.to));
  return ranges.length ? Decoration.set(ranges, true) : Decoration.none;
}

/** Delay selected-text occurrence highlighting; every new edit/selection cancels the prior request. */
export function selectionInstanceHighlightExtension(delaySeconds = DEFAULT_SELECTION_INSTANCE_HIGHLIGHT_DELAY) {
  const delayMilliseconds = normalizeSelectionInstanceHighlightDelay(delaySeconds) * 1000;
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.destroyed = false;
      this.refresh = delayMilliseconds > 0
        ? createTrailingDebounce(() => {
          if (!this.destroyed) this.view.dispatch({ effects: refreshSelectionMatchHighlights.of(null) });
        }, delayMilliseconds)
        : null;
      const shouldDelay = Boolean(this.refresh && hasHighlightableSelection(view.state));
      this.decorations = shouldDelay ? Decoration.none : decorationsFor(view);
      if (shouldDelay) this.refresh.schedule();
    }

    update(update) {
      const explicitlyRefreshes = update.transactions.some(transaction =>
        transaction.effects.some(effect => effect.is(refreshSelectionMatchHighlights)));
      if (explicitlyRefreshes) {
        this.refresh?.cancel();
        this.decorations = decorationsFor(update.view);
        return;
      }
      if (update.selectionSet || update.docChanged) {
        this.decorations = Decoration.none;
        this.refresh?.cancel();
        if (this.refresh && hasHighlightableSelection(update.state)) this.refresh.schedule();
        else this.decorations = decorationsFor(update.view);
        return;
      }
      if (update.viewportChanged && !this.refresh?.pending) this.decorations = decorationsFor(update.view);
    }

    destroy() {
      this.destroyed = true;
      this.refresh?.cancel();
    }
  }, { decorations: plugin => plugin.decorations });
}
