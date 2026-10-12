function normalizeSearchText(value) {
  return String(value ?? '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase();
}

function subsequencePenalty(haystack, needle) {
  let previous = -1;
  let gaps = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, previous + 1);
    if (found < 0) return Infinity;
    if (previous >= 0) gaps += found - previous - 1;
    previous = found;
  }
  return 24 + gaps;
}

function tokenPenalty(item, token) {
  const fields = [item.label, item.group, item.id, item.accelerator]
    .map(normalizeSearchText)
    .filter(Boolean);
  let best = Infinity;
  fields.forEach((field, index) => {
    const position = field.indexOf(token);
    if (position >= 0) best = Math.min(best, index * 10 + Math.min(position, 8));
    else best = Math.min(best, index * 10 + subsequencePenalty(field, token));
  });
  return best;
}

/** Rank menu commands by label, menu path, identifier, or shortcut text. */
export function filterQuickActions(items, query = '', limit = 50) {
  if (!Array.isArray(items)) return [];
  const maximum = Number.isSafeInteger(limit) ? Math.max(0, Math.min(200, limit)) : 50;
  if (!maximum) return [];
  const tokens = normalizeSearchText(query).trim().split(/\s+/u).filter(Boolean);
  if (!tokens.length) return items.slice(0, maximum);

  return items
    .map((item, index) => {
      const score = tokens.reduce((total, token) => {
        const penalty = tokenPenalty(item, token);
        return Number.isFinite(penalty) ? total + penalty : Infinity;
      }, 0);
      return { item, index, score };
    })
    .filter(result => Number.isFinite(result.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, maximum)
    .map(result => result.item);
}
