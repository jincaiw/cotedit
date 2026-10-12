export const MAX_CUSTOM_COT_SYNTAXES = 20;

/** Merge normalized packages without mutating current state; optionally reject a batch that would evict an existing mode. */
export function mergeImportedCotSyntaxes(existing, imported, { rejectOverflow = false } = {}) {
  if (!Array.isArray(existing) || !Array.isArray(imported) || imported.length === 0) {
    throw new Error('语法导入批次无效。');
  }
  let next = existing.slice();
  for (const syntax of imported) {
    if (!syntax || typeof syntax !== 'object' || !/^cot-syntax-[a-z0-9-]{1,56}$/.test(syntax.id || '')) {
      throw new Error('语法包格式无效。');
    }
    next = next.filter(item => item?.id !== syntax.id);
    next.push(syntax);
  }
  if (rejectOverflow && next.length > MAX_CUSTOM_COT_SYNTAXES) {
    throw new Error(`导入后自定义语法会超过 ${MAX_CUSTOM_COT_SYNTAXES} 个上限；现有列表保持不变。`);
  }
  return next.slice(-MAX_CUSTOM_COT_SYNTAXES);
}
