const WORD_PREFIX = /[\p{L}\p{N}\p{M}_]+$/u;
const AUTOMATIC_MINIMUM_PREFIX_SCALARS = 3;

/** Combine CodeMirror language completion providers as syntax-defined words. */
export function syntaxWordCompletionSource(context) {
  const before = context?.matchBefore?.(WORD_PREFIX);
  if (!context?.explicit && (!before || Array.from(before.text).length < AUTOMATIC_MINIMUM_PREFIX_SCALARS)) return null;

  const providers = context.state.languageDataAt('autocomplete', context.pos)
    .filter(provider => typeof provider === 'function');
  if (!providers.length) return null;

  const results = providers.map(provider => {
    try { return provider(context); }
    catch { return null; }
  });
  const combine = values => {
    const usable = values.filter(value => value && Array.isArray(value.options) && Number.isInteger(value.from));
    if (!usable.length) return null;
    const seen = new Set();
    const options = [];
    for (const result of usable) {
      for (const option of result.options) {
        if (!option || typeof option.label !== 'string') continue;
        const key = option.label.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ ...option, section: { name: '语法', rank: 10 } });
      }
    }
    if (!options.length) return null;
    return { from: Math.min(...usable.map(result => result.from)), options };
  };

  return results.some(value => value && typeof value.then === 'function')
    ? Promise.all(results.map(value => Promise.resolve(value).catch(() => null))).then(combine)
    : combine(results);
}
