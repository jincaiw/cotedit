const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('und', { granularity: 'grapheme' })
  : null;

/** Return whether a nonempty string consists of exactly one extended grapheme. */
export function isSingleGrapheme(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (!graphemeSegmenter) return Array.from(value).length === 1;

  const iterator = graphemeSegmenter.segment(value)[Symbol.iterator]();
  const first = iterator.next();
  return !first.done
    && first.value.index === 0
    && first.value.segment.length === value.length
    && iterator.next().done;
}
