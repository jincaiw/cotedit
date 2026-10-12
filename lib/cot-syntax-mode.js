import { StreamLanguage, getIndentUnit, indentService } from '@codemirror/language';
import { completeFromList } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { compileCotSyntaxOutline, compileCotSyntaxRule } from './cot-syntax-regexp.js';
import { isSingleGrapheme } from './unicode-grapheme.js';

const tokenByCategory = {
  keywords: 'keyword', commands: 'function', types: 'typeName', attributes: 'attributeName',
  variables: 'variableName', values: 'atom', numbers: 'number', strings: 'string',
  characters: 'character', comments: 'comment'
};
const wordCharacter = /[\p{L}\p{N}\p{M}_$]/u;
const MAX_REGEX_LINE_LENGTH = 8192;
const MAX_OUTLINE_TEXT_LENGTH = 1_000_000;
const MAX_OUTLINE_ITEMS = 500;
const MAX_INDENT_SCAN_LENGTH = 200_000;
const literalEndRegexCache = new WeakMap();

function pointWidth(text, offset) {
  return text.codePointAt(offset) > 0xffff ? 2 : 1;
}

function previousPoint(text, offset) {
  if (offset <= 0) return '';
  const last = text.charCodeAt(offset - 1);
  if (last >= 0xdc00 && last <= 0xdfff && offset > 1) {
    const first = text.charCodeAt(offset - 2);
    if (first >= 0xd800 && first <= 0xdbff) return text.slice(offset - 2, offset);
  }
  return text.slice(offset - 1, offset);
}

function matchesAt(text, offset, value, ignoreCase = false) {
  const candidate = text.slice(offset, offset + value.length);
  return ignoreCase ? candidate.toLocaleLowerCase() === value.toLocaleLowerCase() : candidate === value;
}

function hasWordBoundary(text, start, end, value) {
  const first = [...value][0] || '';
  const last = [...value].at(-1) || '';
  if (wordCharacter.test(first) && wordCharacter.test(previousPoint(text, start))) return false;
  if (wordCharacter.test(last) && wordCharacter.test(String.fromCodePoint(text.codePointAt(end) || 0))) return false;
  return true;
}

function scanDelimited(stream, state, delimiter, token) {
  const text = stream.string;
  let offset = stream.pos;
  while (offset < text.length) {
    const escape = delimiter.escapeCharacter;
    if (escape && matchesAt(text, offset, escape)) {
      offset += escape.length;
      if (offset < text.length) offset += pointWidth(text, offset);
      continue;
    }
    if (matchesAt(text, offset, delimiter.end)) {
      stream.pos = offset + delimiter.end.length;
      state.quote = null;
      return token;
    }
    offset += pointWidth(text, offset);
  }
  stream.pos = text.length;
  if (!delimiter.isMultiline) state.quote = null;
  return token;
}

function scanBlock(stream, state) {
  let offset = stream.pos;
  while (offset < stream.string.length) {
    const endAt = stream.string.indexOf(state.block.end, offset);
    const beginAt = state.block.isNestable ? stream.string.indexOf(state.block.begin, offset) : -1;
    if (beginAt >= 0 && (endAt < 0 || beginAt < endAt)) {
      state.block.depth = (state.block.depth || 1) + 1;
      offset = beginAt + state.block.begin.length;
      continue;
    }
    if (endAt < 0) {
      stream.skipToEnd();
      return 'comment';
    }
    state.block.depth = (state.block.depth || 1) - 1;
    offset = endAt + state.block.end.length;
    if (state.block.depth === 0) {
      stream.pos = offset;
      state.block = null;
      return 'comment';
    }
  }
  stream.skipToEnd();
  return 'comment';
}

function makeLiteralIndex(rules) {
  const exact = new Map();
  const folded = new Map();
  for (const rule of rules) {
    const first = [...rule.begin][0];
    const bucket = rule.ignoreCase ? folded : exact;
    const key = rule.ignoreCase ? first.toLocaleLowerCase() : first;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(rule);
  }
  return { exact, folded };
}

function literalCandidatesAt(text, offset, index) {
  const first = String.fromCodePoint(text.codePointAt(offset) || 0);
  return [...(index.exact.get(first) || []), ...(index.folded.get(first.toLocaleLowerCase()) || [])];
}

function collectRegexMatches(text, rules) {
  const byPosition = new Map();
  if (text.length > MAX_REGEX_LINE_LENGTH) return byPosition;
  for (const rule of rules) {
    const regex = rule.compiled.begin;
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text))) {
      if (match[0].length) {
        const list = byPosition.get(match.index) || [];
        list.push({ rule, length: match[0].length });
        byPosition.set(match.index, list);
      }
      if (match[0].length === 0) {
        const codePoint = text.codePointAt(regex.lastIndex);
        regex.lastIndex += codePoint != null && codePoint > 0xffff ? 2 : 1;
      }
    }
  }
  for (const candidates of byPosition.values()) candidates.sort((a, b) => b.length - a.length || a.rule.order - b.rule.order);
  return byPosition;
}

function findEnd(text, offset, rule) {
  if (rule.compiled?.end) {
    const regex = rule.compiled.end;
    regex.lastIndex = offset;
    const match = regex.exec(text);
    return match ? { from: match.index, to: match.index + match[0].length } : null;
  }
  const end = rule.end;
  if (!end) return null;
  if (!rule.ignoreCase) {
    const found = text.indexOf(end, offset);
    return found < 0 ? null : { from: found, to: found + end.length };
  }
  let regex = literalEndRegexCache.get(rule);
  if (!regex) {
    regex = new RegExp(escapeRegex(end), 'giu');
    literalEndRegexCache.set(rule, regex);
  }
  regex.lastIndex = offset;
  const match = regex.exec(text);
  return match ? { from: match.index, to: match.index + match[0].length } : null;
}

function scanRange(stream, state) {
  const range = state.activeRange;
  const found = findEnd(stream.string, stream.pos, range.rule);
  if (found) {
    stream.pos = Math.max(found.to, stream.pos + (found.to === found.from && stream.pos < stream.string.length ? pointWidth(stream.string, stream.pos) : 0));
    state.activeRange = null;
    return range.rule.token;
  }
  stream.skipToEnd();
  if (!range.rule.isMultiline) state.activeRange = null;
  return range.rule.token;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function regexForLiteralEndings(pairs) {
  const endings = pairs.map(pair => pair.end).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!endings.length) return null;
  try { return new RegExp(`^\\s*(?:${endings.map(escapeRegex).join('|')})\\s*$`, 'u'); }
  catch { return null; }
}

function indentationTokens(definition) {
  return (definition.indentation?.blockDelimiters || [])
    .filter(item => item && typeof item.begin === 'string' && item.begin)
    .map(item => ({ begin: item.begin, end: typeof item.end === 'string' ? item.end : '', ignoreCase: item.ignoreCase === true }))
    .sort((a, b) => Math.max(b.begin.length, b.end.length) - Math.max(a.begin.length, a.end.length));
}

function closeStack(stack, end) {
  if (!end) return null;
  for (let index = stack.length - 1; index >= 0; index--) {
    if (stack[index].end === end) {
      const indent = stack[index].indent;
      stack.splice(index);
      return indent;
    }
  }
  return null;
}

function leadingColumns(line, tabSize) {
  const prefix = /^[\t ]*/.exec(line)?.[0] || '';
  let column = 0;
  for (const character of prefix) column += character === '\t' ? tabSize - (column % tabSize) : 1;
  return column;
}

function scanIndentLine(line, definition, state, stack, baseIndent, tokens) {
  let offset = 0;
  let dedent = null;
  const inlineComments = definition.comments?.inline || [];
  const blockComments = definition.comments?.blocks || [];
  const quoted = [
    ...orderedDelimitedPairs(definition.strings),
    ...orderedDelimitedPairs(definition.characters)
  ];
  while (offset < line.length) {
    if (state.block) {
      const end = line.indexOf(state.block.end, offset);
      const begin = state.block.isNestable ? line.indexOf(state.block.begin, offset) : -1;
      if (begin >= 0 && (end < 0 || begin < end)) {
        state.block.depth = (state.block.depth || 1) + 1;
        offset = begin + state.block.begin.length;
        continue;
      }
      if (end < 0) return;
      state.block.depth = (state.block.depth || 1) - 1;
      offset = end + state.block.end.length;
      if (state.block.depth === 0) state.block = null;
      continue;
    }
    if (state.quote) {
      let closed = false;
      while (offset < line.length) {
        const delimiter = state.quote;
        if (delimiter.escapeCharacter && matchesAt(line, offset, delimiter.escapeCharacter)) {
          offset += delimiter.escapeCharacter.length;
          if (offset < line.length) offset += pointWidth(line, offset);
        } else if (matchesAt(line, offset, delimiter.end)) {
          offset += delimiter.end.length;
          state.quote = null;
          closed = true;
          break;
        } else offset += pointWidth(line, offset);
      }
      if (!closed) {
        if (!state.quote.isMultiline) state.quote = null;
        return;
      }
      continue;
    }

    let commentStarted = false;
    for (const comment of blockComments) {
      if (comment?.begin && comment.end && matchesAt(line, offset, comment.begin)) {
        state.block = { ...comment, depth: 1 };
        offset += comment.begin.length;
        commentStarted = true;
        break;
      }
    }
    if (commentStarted) continue;
    for (const comment of inlineComments) {
      if (comment?.begin && matchesAt(line, offset, comment.begin)
          && (!comment.leadingOnly || !line.slice(0, offset).trim())) return;
    }
    for (const delimiter of quoted) {
      if (matchesAt(line, offset, delimiter.begin)) {
        state.quote = delimiter;
        offset += delimiter.begin.length;
        commentStarted = true;
        break;
      }
    }
    if (commentStarted) continue;

    let matched = false;
    for (const token of tokens) {
      const opening = matchesAt(line, offset, token.begin, token.ignoreCase);
      const closing = token.end && matchesAt(line, offset, token.end, token.ignoreCase);
      if (!opening && !closing) continue;
      if (closing && (!opening || token.end.length >= token.begin.length)) {
        const closeIndent = closeStack(stack, token.end);
        if (closeIndent !== null && !line.slice(0, offset).trim()) dedent = closeIndent;
        offset += token.end.length;
      } else {
        if (token.end) stack.push({ end: token.end, indent: baseIndent });
        else stack.push({ end: '', indent: baseIndent });
        offset += token.begin.length;
      }
      matched = true;
      break;
    }
    if (!matched) offset += pointWidth(line, offset);
  }
  return dedent;
}

function syntaxIndentService(definition) {
  const tokens = indentationTokens(definition);
  if (!tokens.length) return [];
  const service = indentService.of((context, pos) => {
    const doc = context.state.doc;
    const start = Math.max(0, pos - MAX_INDENT_SCAN_LENGTH);
    const partial = doc.sliceString(start, pos);
    const lines = partial.split('\n');
    if (start > 0) lines.shift();
    const stack = [];
    const lexicalState = { block: null, quote: null };
    const unit = getIndentUnit(context.state) || 2;
    let currentLineDedent = null;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const indent = leadingColumns(line, context.state.tabSize || 4);
      const dedent = scanIndentLine(line, definition, lexicalState, stack, indent, tokens);
      if (index === lines.length - 1 && dedent !== null) currentLineDedent = dedent;
    }
    if (currentLineDedent !== null) return currentLineDedent;
    if (!stack.length) return null;
    return Math.max(0, stack.at(-1).indent + unit);
  });
  return [service];
}

function regexMatch(rule, match) {
  if (rule.regularExpression === true) return match?.length || 0;
  if (!matchesAt(match.text, match.offset, rule.begin, rule.ignoreCase)) return 0;
  if (!rule.end && !hasWordBoundary(match.text, match.offset, match.offset + rule.begin.length, rule.begin)) return 0;
  return rule.begin.length;
}

export function getCotSyntaxSupportSummary(definition = {}) {
  const unsupported = definition.unsupported || {};
  const counts = {
    highlightRules: Math.max(0, Number(unsupported.highlightRules) || 0),
    outlineRules: Math.max(0, Number(unsupported.outlineRules) || 0),
    indentationRules: Math.max(0, Number(unsupported.indentationRules) || 0)
  };
  for (const rule of definition.rules || []) {
    if (rule.regularExpression === true && !compileCotSyntaxRule(rule)) counts.highlightRules++;
  }
  for (const rule of definition.outlines || []) {
    if (!compileCotSyntaxOutline(rule)) counts.outlineRules++;
  }
  for (const rule of definition.indentation?.blockDelimiters || []) {
    if (!rule?.begin) counts.indentationRules++;
  }
  return counts;
}

function orderedDelimitedPairs(pairs) {
  return (Array.isArray(pairs) ? pairs : [])
    .filter(pair => pair?.begin && pair?.end)
    .sort((left, right) => right.begin.length - left.begin.length);
}

function isPythonTripleQuoteDelimiter(value) {
  return value === '"""' || value === "'''";
}

function syntaxCompletionWords(definition) {
  const explicit = Array.isArray(definition.completions)
    ? [...new Set(definition.completions.filter(word => typeof word === 'string' && word.length > 0 && word.length <= 512))].slice(0, 2500)
    : [];
  if (explicit.length) return explicit;
  const wordRuleCategories = new Set(['keywords', 'commands', 'types', 'attributes', 'values']);
  const wordPattern = /^[\p{L}_$][\p{L}\p{N}\p{M}_$]*$/u;
  const seen = new Set();
  const words = [];
  for (const rule of Array.isArray(definition.rules) ? definition.rules : []) {
    if (!rule || rule.regularExpression === true || rule.end || !wordRuleCategories.has(rule.category)
      || typeof rule.begin !== 'string' || !wordPattern.test(rule.begin)) continue;
    const key = rule.begin.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(rule.begin);
    if (words.length >= 2500) break;
  }
  return words;
}

function quotePairRules(definition) {
  const rules = [];
  for (const delimiter of [...(definition.strings || []), ...(definition.characters || [])]) {
    if (!delimiter
      || !(isSingleGrapheme(delimiter.begin) || isPythonTripleQuoteDelimiter(delimiter.begin))
      || !(isSingleGrapheme(delimiter.end) || isPythonTripleQuoteDelimiter(delimiter.end))) continue;
    const escapeCharacter = delimiter.escapeCharacter || '';
    if (escapeCharacter && !isSingleGrapheme(escapeCharacter)) continue;
    const prefixes = [...new Set((Array.isArray(delimiter.prefixes) ? delimiter.prefixes : [])
      .filter(prefix => typeof prefix === 'string' && prefix.length > 0 && prefix.length <= 128))]
      .sort((left, right) => right.length - left.length);
    const existing = rules.find(rule => rule.begin === delimiter.begin && rule.end === delimiter.end && rule.escapeCharacter === escapeCharacter);
    if (!existing) {
      rules.push({ begin: delimiter.begin, end: delimiter.end, escapeCharacter, prefixes });
    } else if (!existing.prefixes.length || !prefixes.length) {
      existing.prefixes = [];
    } else {
      existing.prefixes = [...new Set([...existing.prefixes, ...prefixes])]
        .sort((left, right) => right.length - left.length);
    }
  }
  return rules;
}

export function createCotSyntaxMode(definition) {
  const compiledRules = [];
  let order = 0;
  for (const sourceRule of definition.rules || []) {
    const token = tokenByCategory[sourceRule.category];
    if (!token || !sourceRule.begin) continue;
    const rule = { ...sourceRule, token, order: order++ };
    if (rule.regularExpression === true) {
      rule.compiled = compileCotSyntaxRule(rule);
      if (!rule.compiled) continue;
    }
    compiledRules.push(rule);
  }
  const regexRules = compiledRules.filter(rule => rule.regularExpression === true);
  const literalRules = compiledRules.filter(rule => rule.regularExpression !== true);
  const literalIndex = makeLiteralIndex(literalRules);
  const inlineComments = definition.comments?.inline || [];
  const blockComments = definition.comments?.blocks || [];
  const strings = orderedDelimitedPairs(definition.strings);
  const characters = orderedDelimitedPairs(definition.characters);
  const commentTokens = {};
  if (inlineComments[0]?.begin) commentTokens.line = inlineComments[0].begin;
  if (blockComments[0]?.begin && blockComments[0]?.end) {
    commentTokens.block = {
      open: blockComments[0].begin,
      close: blockComments[0].end,
      ...(blockComments[0].isNestable === true ? { isNestable: true } : {})
    };
  }
  const coteditCommentTokens = {
    inlines: inlineComments
      .filter(item => item?.begin)
      .map(item => item.begin),
    blocks: blockComments
      .filter(item => item?.begin && item?.end)
      .map(item => ({
        open: item.begin,
        close: item.end,
        ...(item.isNestable === true ? { isNestable: true } : {})
      }))
  };
  const coteditQuotePairs = quotePairRules(definition);
  const closePattern = regexForLiteralEndings(indentationTokens(definition));
  const languageData = { commentTokens, coteditCommentTokens };
  if (coteditQuotePairs.length) languageData.coteditQuotePairs = coteditQuotePairs;
  if (closePattern) languageData.indentOnInput = closePattern;
  const completionWords = syntaxCompletionWords(definition);
  if (completionWords.length) languageData.autocomplete = completeFromList(completionWords);
  const mode = StreamLanguage.define({
    name: `CotEditor: ${definition.name}`,
    blankLine(state) {
      if (state.activeRange?.rule.compiled?.endOnBlankLine) state.activeRange = null;
    },
    languageData,
    tokenTable: {
      keyword: tags.keyword, function: tags.function(tags.variableName), typeName: tags.typeName,
      attributeName: tags.attributeName, variableName: tags.variableName, atom: tags.atom,
      number: tags.number, string: tags.string, character: tags.character, comment: tags.comment
    },
    startState: () => ({ block: null, quote: null, activeRange: null, regexMatches: new Map(), regexLine: null }),
    token(stream, state) {
      if (stream.sol() && state.activeRange?.rule.compiled?.endOnBlankLine && /^[\t ]*$/.test(stream.string)) {
        state.activeRange = null;
        stream.skipToEnd();
        return null;
      }
      if (stream.eol()) return null;
      if (stream.sol() && state.regexLine !== stream.string) {
        state.regexLine = stream.string;
        state.regexMatches = collectRegexMatches(stream.string, regexRules);
      }
      if (state.block) return scanBlock(stream, state);
      if (state.quote) return scanDelimited(stream, state, state.quote.delimiter, state.quote.token);
      if (state.activeRange) return scanRange(stream, state);

      for (const comment of blockComments) {
        if (comment?.begin && comment.end && matchesAt(stream.string, stream.pos, comment.begin)) {
          stream.pos += comment.begin.length;
          state.block = { ...comment, depth: 1 };
          return scanBlock(stream, state);
        }
      }
      for (const comment of inlineComments) {
        if (comment?.begin && matchesAt(stream.string, stream.pos, comment.begin)) {
          if (comment.leadingOnly && stream.string.slice(0, stream.pos).trim()) continue;
          stream.skipToEnd();
          return 'comment';
        }
      }
      for (const [delimiters, token] of [[strings, 'string'], [characters, 'character']]) {
        for (const delimiter of delimiters) {
          if (!matchesAt(stream.string, stream.pos, delimiter.begin)) continue;
          stream.pos += delimiter.begin.length;
          state.quote = { delimiter, token };
          return scanDelimited(stream, state, delimiter, token);
        }
      }

      const candidates = [
        ...(state.regexMatches.get(stream.pos) || []).map(item => ({ rule: item.rule, length: item.length })),
        ...literalCandidatesAt(stream.string, stream.pos, literalIndex).map(rule => ({ rule, length: rule.begin.length }))
      ].sort((a, b) => b.length - a.length || a.rule.order - b.rule.order);
      for (const candidate of candidates) {
        const rule = candidate.rule;
        if (rule.regularExpression !== true && !regexMatch(rule, { text: stream.string, offset: stream.pos })) continue;
        if (!rule.regularExpression && !matchesAt(stream.string, stream.pos, rule.begin, rule.ignoreCase)) continue;
        const startLength = candidate.length;
        stream.pos += startLength || (stream.pos < stream.string.length ? pointWidth(stream.string, stream.pos) : 0);
        if (rule.end) {
          state.activeRange = { rule };
          return scanRange(stream, state);
        }
        return rule.token;
      }
      stream.next();
      return null;
    }
  });
  const indentExtension = syntaxIndentService(definition);
  return [mode, ...indentExtension];
}

function replaceTemplate(template, match) {
  return String(template).replace(/\$(\$|&|\d{1,2}|\{[\p{L}\p{N}_]+\})/gu, (token, capture) => {
    if (capture === '$') return '$';
    if (capture === '&' || capture === '0') return match[0] || '';
    if (capture.startsWith('{')) return match.groups?.[capture.slice(1, -1)] || '';
    return match[Number(capture)] || '';
  });
}

function indentLevel(value) {
  let column = 0;
  for (const character of value) column += character === '\t' ? 4 - (column % 4) : 1;
  return Math.floor(column / 4);
}

export function getCotSyntaxOutline(text = '', definition = {}) {
  const source = String(text);
  const rules = (definition.outlines || []).slice(0, 256);
  if (!rules.length || source.length > MAX_OUTLINE_TEXT_LENGTH) return [];
  const lineStarts = [0];
  for (let offset = 0; offset < source.length; offset++) if (source[offset] === '\n') lineStarts.push(offset + 1);
  const lineAt = position => {
    let low = 0;
    let high = lineStarts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (lineStarts[middle] <= position) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const found = [];
  let order = 0;
  for (const rule of rules) {
    const regex = compileCotSyntaxOutline(rule);
    if (!regex) { order++; continue; }
    regex.lastIndex = 0;
    let match;
    let perRule = 0;
    while (perRule < MAX_OUTLINE_ITEMS && found.length < MAX_OUTLINE_ITEMS && (match = regex.exec(source))) {
      if (!match[0].length) {
        const codePoint = source.codePointAt(regex.lastIndex);
        regex.lastIndex += codePoint != null && codePoint > 0xffff ? 2 : 1;
        continue;
      }
      const raw = rule.template ? replaceTemplate(rule.template, match) : match[0];
      const normalized = raw.replace(/(\S)\s+/gu, '$1 ');
      if (rule.kind === 'separator') {
        found.push({ from: match.index, order, item: { line: lineAt(match.index), level: 0, label: '────────', kind: 'separator' } });
      } else {
        const titleMatch = /^(?<indent>\s*)(?<title>.+)$/u.exec(normalized);
        if (titleMatch?.groups?.title?.trim()) {
          const kind = rule.kind || null;
          const headingLevel = /^heading\.(\d)$/.exec(kind || '');
          const level = kind === 'title' ? 0
            : headingLevel ? Math.max(0, Number(headingLevel[1]) - 1)
              : kind === 'heading' ? 0
                : Math.min(12, indentLevel(titleMatch.groups.indent));
          found.push({ from: match.index, order, item: { line: lineAt(match.index), level, label: titleMatch.groups.title.trim().slice(0, 240), kind } });
        }
      }
      perRule++;
      if (match[0].length === 0) regex.lastIndex++;
    }
    order++;
  }
  return found.sort((a, b) => a.from - b.from || a.order - b.order).slice(0, MAX_OUTLINE_ITEMS).map(entry => entry.item);
}
