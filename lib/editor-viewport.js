import { Decoration } from '@codemirror/view';

const pendingVerticalScrolls = new WeakMap();

/** Keep both physical scroll axes when replacing a mirrored editor state. */
export function setEditorStatePreservingScroll(view, state) {
  if (!view || typeof view.setState !== 'function') return;
  const scrollDOM = view.scrollDOM;
  const scrollLeft = scrollDOM?.scrollLeft ?? 0;
  const scrollTop = scrollDOM?.scrollTop ?? 0;
  view.setState(state);
  if (scrollDOM) {
    scrollDOM.scrollLeft = scrollLeft;
    scrollDOM.scrollTop = scrollTop;
  }
}

function axisScrollDelta(targetStart, targetEnd, viewportStart, viewportEnd, strategy, margin, startAtEnd = false) {
  if (strategy === 'center') return (targetStart + targetEnd - viewportStart - viewportEnd) / 2;
  if (strategy === 'start') {
    return startAtEnd ? targetEnd - (viewportEnd - margin) : targetStart - (viewportStart + margin);
  }
  if (strategy === 'end') {
    return startAtEnd ? targetStart - (viewportStart + margin) : targetEnd - (viewportEnd - margin);
  }
  if (targetStart < viewportStart + margin) return targetStart - (viewportStart + margin);
  if (targetEnd > viewportEnd - margin) return targetEnd - (viewportEnd - margin);
  return 0;
}

function applyVerticalScroll(view, range, options) {
  const scrollDOM = view?.scrollDOM;
  if (!scrollDOM || !range || typeof view.coordsAtPos !== 'function' || typeof scrollDOM.getBoundingClientRect !== 'function') return false;

  const visibleRanges = view.visibleRanges;
  if (Array.isArray(visibleRanges)) {
    const start = Math.min(range.anchor, range.head);
    const end = Math.max(range.anchor, range.head);
    const rendered = visibleRanges.some(({ from, to }) => start === end
      ? start >= from && start <= to
      : start <= to && end >= from);
    if (!rendered) return false;
  }

  let headRect;
  let anchorRect;
  try {
    const headSide = range.assoc || (range.head > range.anchor ? -1 : 1);
    headRect = view.coordsAtPos(range.head, headSide);
    if (range.head !== range.anchor) {
      const anchorSide = range.anchor > range.head ? -1 : 1;
      anchorRect = view.coordsAtPos(range.anchor, anchorSide);
    }
  } catch {
    return false;
  }
  if (!headRect) return false;

  const rects = anchorRect ? [headRect, anchorRect] : [headRect];
  const target = {
    left: Math.min(...rects.map(rect => rect.left)),
    right: Math.max(...rects.map(rect => rect.right)),
    top: Math.min(...rects.map(rect => rect.top)),
    bottom: Math.max(...rects.map(rect => rect.bottom))
  };
  const bounds = scrollDOM.getBoundingClientRect();
  const scaleX = scrollDOM.offsetWidth ? bounds.width / scrollDOM.offsetWidth : 1;
  const scaleY = scrollDOM.offsetHeight ? bounds.height / scrollDOM.offsetHeight : 1;
  const viewport = {
    left: bounds.left + (scrollDOM.clientLeft || 0) * scaleX,
    right: bounds.left + ((scrollDOM.clientLeft || 0) + scrollDOM.clientWidth) * scaleX,
    top: bounds.top + (scrollDOM.clientTop || 0) * scaleY,
    bottom: bounds.top + ((scrollDOM.clientTop || 0) + scrollDOM.clientHeight) * scaleY
  };
  if (!(viewport.right > viewport.left && viewport.bottom > viewport.top)) return false;

  const moveX = scrollDOM.scrollWidth > scrollDOM.clientWidth
    ? axisScrollDelta(target.left, target.right, viewport.left, viewport.right, options.x, options.xMargin ?? 5, true)
    : 0;
  const moveY = axisScrollDelta(target.top, target.bottom, viewport.top, viewport.bottom, options.y, options.yMargin ?? 5);
  if (Number.isFinite(moveX) && moveX) scrollDOM.scrollLeft += moveX / scaleX;
  if (Number.isFinite(moveY) && moveY) scrollDOM.scrollTop += moveY / scaleY;
  return true;
}

/**
 * Queue a vertical-rl scroll correction after CodeMirror finishes its update.
 * The public coordsAtPos API reads layout and must not be called synchronously
 * from EditorView.scrollHandler, which runs during the update cycle.
 */
export function scrollVerticalSelectionIntoView(view, range, options = {}, scheduleFrame) {
  if (!view?.scrollDOM || !range || typeof view.coordsAtPos !== 'function') return false;

  const request = {
    range: { anchor: range.anchor, head: range.head, assoc: range.assoc },
    options: { ...options },
    state: view.state
  };
  let pending = pendingVerticalScrolls.get(view);
  if (pending) {
    pending.request = request;
    return true;
  }

  pending = { request };
  pendingVerticalScrolls.set(view, pending);
  const schedule = scheduleFrame ?? (typeof requestAnimationFrame === 'function' ? callback => requestAnimationFrame(callback) : callback => callback());
  schedule(() => {
    if (pendingVerticalScrolls.get(view) !== pending) return;
    pendingVerticalScrolls.delete(view);
    const latest = pending.request;
    if (latest.state && view.state !== latest.state) return;
    if (view.state?.doc && Math.max(latest.range.anchor, latest.range.head) > view.state.doc.length) return;
    applyVerticalScroll(view, latest.range, latest.options);
  });
  return true;
}

/** Decorate a rendered vertical-writing line with its document line number. */
export function verticalLineNumberDecoration(line) {
  if (!line || !Number.isInteger(line.number) || !Number.isInteger(line.from)) return null;
  return Decoration.line({ attributes: { 'data-line-number': String(line.number) } }).range(line.from);
}

/** Position a rendered CodeMirror line at its document column in vertical-rl flow. */
export function verticalColumnDecoration(line, columnStep, blockTop = 0) {
  if (!line || !Number.isInteger(line.number) || !Number.isInteger(line.from)
      || !Number.isFinite(columnStep) || columnStep <= 0 || !Number.isFinite(blockTop)) return null;
  const right = (line.number - 1) * columnStep;
  return Decoration.line({ attributes: {
    'data-line-number': String(line.number),
    style: `position:absolute;top:${blockTop}px;right:${right}px;height:auto;`
  } }).range(line.from);
}
