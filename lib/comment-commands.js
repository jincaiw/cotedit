import { blockComment, blockUncomment, lineComment, lineUncomment, toggleBlockCommentByLine } from '@codemirror/commands';
import { EditorSelection, EditorState } from '@codemirror/state';

function commentChangesWithoutSpacer(state, changes, style) {
  const lineTokens = style === 'line' ? inlineCommentVariants(state) : [];
  const blockTokens = style === 'block' ? blockCommentVariants(state) : [];
  const result = [];
  changes.iterChanges((from, to, _fromB, _toB, insertedText) => {
    let adjustedFrom = from;
    let adjustedTo = to;
    let insert = insertedText.toString();

    if (from === to && insert) {
      if (style === 'line') {
        if (insert.endsWith(' ')) insert = insert.slice(0, -1);
      } else {
        const emptyPair = blockTokens.find(token => insert === `${token.open}  ${token.close}`);
        if (emptyPair) {
          insert = `${emptyPair.open}${emptyPair.close}`;
        } else if (blockTokens.some(token => insert.startsWith(token.open) && insert.endsWith(' '))) {
          insert = insert.slice(0, -1);
        } else if (blockTokens.some(token => insert.startsWith(' ') && insert.endsWith(token.close))) {
          insert = insert.slice(1);
        }
      }
    } else if (from < to && !insert) {
      const removed = state.doc.sliceString(from, to);
      if (style === 'line') {
        if (lineTokens.some(token => removed.startsWith(token) && removed[token.length] === ' ')) adjustedTo--;
      } else {
        const opening = blockTokens.some(token => removed.startsWith(token.open) && removed[token.open.length] === ' ');
        if (opening) adjustedTo--;
        else if (blockTokens.some(token => removed.startsWith(' ') && removed.slice(1).startsWith(token.close))) adjustedFrom++;
      }
    }

    result.push({ from: adjustedFrom, to: adjustedTo, insert });
  });
  return state.changes(result);
}

function dispatchCommentCommand(view, command, style, appendsSpacer = true) {
  if (!view?.state || typeof view.dispatch !== 'function' || view.state.readOnly) return false;
  const { state } = view;
  if (appendsSpacer) return command(view);

  let transaction = null;
  const handled = command({ state, dispatch: value => { transaction = value; } });
  if (!handled || !transaction) return false;
  const changes = commentChangesWithoutSpacer(state, transaction.changes, style);
  view.dispatch(state.update({ changes, selection: state.selection.map(changes, 1) }));
  return true;
}

export function lineCommentSelection(view, appendsSpacer = true) {
  return dispatchCommentCommand(view, lineComment, 'line', appendsSpacer);
}

export function blockCommentSelection(view, appendsSpacer = true) {
  return dispatchCommentCommand(view, blockComment, 'block', appendsSpacer);
}

/** CotEditor's explicit Comment Out action prefers inline comments. */
export function commentOutSelection(view, appendsSpacer = true) {
  if (!view?.state || typeof view.dispatch !== 'function' || view.state.readOnly) return false;
  return lineCommentSelection(view, appendsSpacer) || blockCommentSelection(view, appendsSpacer);
}

function blockCommentVariants(state, ranges = state.selection?.ranges ?? []) {
  if (typeof state?.languageDataAt !== 'function') return [];
  const positions = ranges.length ? ranges.map(range => range.from) : [0];
  const variants = [];
  const seen = new Set();
  const add = token => {
    if (typeof token?.open !== 'string' || !token.open || typeof token?.close !== 'string' || !token.close) return;
    const key = `${token.open}\u0000${token.close}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({
      open: token.open,
      close: token.close,
      ...(token.isNestable === true ? { isNestable: true } : {})
    });
  };

  for (const position of positions) {
    for (const data of state.languageDataAt('coteditCommentTokens', position, 1)) {
      for (const token of Array.isArray(data?.blocks) ? data.blocks : []) add(token);
    }
    for (const data of state.languageDataAt('commentTokens', position, 1)) add(data?.block);
  }
  return variants;
}

function lineCommentTokensAt(state, position) {
  if (typeof state?.languageDataAt !== 'function') return [];
  const tokens = [];
  const seen = new Set();
  const add = token => {
    if (typeof token !== 'string' || !token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  for (const data of state.languageDataAt('coteditCommentTokens', position, 1)) {
    for (const token of Array.isArray(data?.inlines) ? data.inlines : []) add(token);
  }
  for (const data of state.languageDataAt('commentTokens', position, 1)) add(data?.line);
  return tokens;
}

function inlineCommentVariants(state, ranges = state.selection?.ranges ?? []) {
  if (!state?.doc || typeof state.languageDataAt !== 'function') return [];
  const variants = [];
  const seen = new Set();
  const seenLines = new Set();
  const addAt = position => {
    for (const token of lineCommentTokensAt(state, position)) {
      if (seen.has(token)) continue;
      seen.add(token);
      variants.push(token);
    }
  };

  if (!ranges.length) return lineCommentTokensAt(state, 0);
  for (const range of ranges) {
    const rangeFrom = Math.min(range.from, range.to);
    const rangeTo = Math.max(range.from, range.to);
    for (let position = rangeFrom; position <= rangeTo;) {
      const line = state.doc.lineAt(position);
      if (!seenLines.has(line.from) && (rangeFrom === rangeTo || rangeTo > line.from)) {
        seenLines.add(line.from);
        addAt(line.from);
      }
      position = line.to + 1;
    }
  }
  return variants;
}

function runBlockUncommentProbe(state, selection, token) {
  const extensions = [
    EditorState.languageData.of(() => [{ commentTokens: { block: token } }]),
    EditorState.readOnly.of(state.readOnly)
  ];
  if (selection.ranges.length > 1) extensions.push(EditorState.allowMultipleSelections.of(true));
  const probeState = EditorState.create({ doc: state.doc, selection, extensions });
  let transaction = null;
  const changed = blockUncomment({ state: probeState, dispatch: value => { transaction = value; } });
  return changed && transaction?.docChanged ? transaction : null;
}

function runLineUncommentProbe(state, selection, token) {
  const extensions = [
    EditorState.languageData.of(() => [{ commentTokens: { line: token } }]),
    EditorState.readOnly.of(state.readOnly)
  ];
  if (selection.ranges.length > 1) extensions.push(EditorState.allowMultipleSelections.of(true));
  const probeState = EditorState.create({ doc: state.doc, selection, extensions });
  let transaction = null;
  const changed = lineUncomment({ state: probeState, dispatch: value => { transaction = value; } });
  return changed && transaction?.docChanged ? transaction : null;
}

function applyLineUncommentProbe(view, state, selection, token, appendsSpacer = true) {
  const transaction = runLineUncommentProbe(state, selection, token);
  if (!transaction) return false;
  const changes = appendsSpacer ? transaction.changes : commentChangesWithoutSpacer(state, transaction.changes, 'line');
  view.dispatch(state.update({
    changes,
    selection: state.selection.map(changes, 1)
  }));
  return true;
}

function nestedDelimitersAreBalanced(text, token) {
  const matches = [];
  for (const [delimiter, isBegin] of [[token.open, true], [token.close, false]]) {
    for (let offset = 0, position; (position = text.indexOf(delimiter, offset)) >= 0; offset = position + delimiter.length) {
      matches.push({ position, isBegin });
    }
  }
  matches.sort((left, right) => left.position - right.position || Number(right.isBegin) - Number(left.isBegin));

  let depth = 0;
  for (const match of matches) {
    if (!match.isBegin && depth === 0) return false;
    depth += match.isBegin ? 1 : -1;
  }
  return depth === 0;
}

function isBalancedNestableBlockProbe(state, transaction, token) {
  if (!token.isNestable || token.open === token.close) return true;
  const deletions = [];
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    deletions.push({ from: fromA, to: toA, insert: inserted.toString() });
  });
  if (deletions.length !== 2 || deletions.some(change => change.from === change.to || change.insert)) return false;

  const opening = deletions.find(change => state.doc.sliceString(change.from, change.to).includes(token.open));
  const closing = deletions.find(change => change !== opening && state.doc.sliceString(change.from, change.to).includes(token.close));
  if (!opening || !closing) return false;

  const openingText = state.doc.sliceString(opening.from, opening.to);
  const closingText = state.doc.sliceString(closing.from, closing.to);
  const innerFrom = opening.from + openingText.indexOf(token.open) + token.open.length;
  const innerTo = closing.from + closingText.indexOf(token.close);
  if (innerFrom > innerTo) return false;
  return nestedDelimitersAreBalanced(state.doc.sliceString(innerFrom, innerTo), token);
}

function probeBlockUncomment(state, selection, token) {
  if (!token.isNestable || token.open === token.close) {
    return runBlockUncommentProbe(state, selection, token);
  }

  const changes = [];
  for (const range of selection.ranges) {
    const singleRange = EditorSelection.create([range]);
    const transaction = runBlockUncommentProbe(state, singleRange, token);
    if (!transaction || !isBalancedNestableBlockProbe(state, transaction, token)) continue;
    transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      changes.push({ from: fromA, to: toA, insert: inserted.toString() });
    });
  }
  return changes.length ? state.update({ changes }) : null;
}

function applyBlockUncommentProbe(view, state, selection, token, appendsSpacer = true) {
  const transaction = probeBlockUncomment(state, selection, token);
  if (!transaction) return false;
  const changes = appendsSpacer ? transaction.changes : commentChangesWithoutSpacer(state, transaction.changes, 'block');
  view.dispatch(state.update({
    changes,
    selection: state.selection.map(changes, 1)
  }));
  return true;
}

function blockCommentProbeSelection(state, ranges = state.selection?.ranges ?? []) {
  const targets = new Map();
  for (const range of ranges) {
    let target = range;
    if (range.empty) {
      const line = state.doc.lineAt(range.from);
      target = EditorSelection.range(line.from, line.to);
    }
    const key = `${target.from}:${target.to}`;
    if (!targets.has(key)) targets.set(key, target);
  }
  return EditorSelection.create([...targets.values()]);
}

/**
 * CotEditor treats an empty caret as the current line when explicitly
 * uncommenting. CodeMirror's line command already does this, but its block
 * command needs a non-empty range. Probe the current lines for block wrappers
 * first, then keep the original selection mapped through the resulting edit.
 */
export function uncommentSelection(view, appendsSpacer = true) {
  if (!view?.state || typeof view.dispatch !== 'function' || view.state.readOnly) return false;
  const { state } = view;
  const ranges = state.selection?.ranges ?? [];

  if (ranges.length && ranges.some(range => range.empty)) {
    const targets = new Map();
    for (const range of ranges) {
      let target = range;
      if (range.empty) {
        const line = state.doc.lineAt(range.from);
        target = EditorSelection.range(line.from, line.to);
      }
      const key = `${target.from}:${target.to}`;
      if (!targets.has(key)) targets.set(key, target);
    }
    const selection = EditorSelection.create([...targets.values()]);
    for (const token of blockCommentVariants(state, [...targets.values()])) {
      if (applyBlockUncommentProbe(view, state, selection, token, appendsSpacer)) return true;
    }
  }

  const variants = blockCommentVariants(state, ranges);
  if (variants[0]?.isNestable) {
    for (const token of variants) {
      if (applyBlockUncommentProbe(view, state, state.selection, token, appendsSpacer)) return true;
    }
  } else if (dispatchCommentCommand(view, blockUncomment, 'block', appendsSpacer)) {
    return true;
  } else for (const token of variants.slice(1)) {
    if (applyBlockUncommentProbe(view, state, state.selection, token, appendsSpacer)) return true;
  }
  if (dispatchCommentCommand(view, lineUncomment, 'line', appendsSpacer)) return true;
  for (const token of inlineCommentVariants(state, ranges)) {
    if (applyLineUncommentProbe(view, state, state.selection, token, appendsSpacer)) return true;
  }
  return false;
}

function indentation(text, tabWidth) {
  let width = 0;
  let length = 0;
  for (const character of text) {
    if (character === ' ') width += 1;
    else if (character === '\t') width += tabWidth;
    else break;
    length += character.length;
  }
  return { width, length };
}

function offsetAtVisualIndent(text, targetWidth, tabWidth) {
  let width = 0;
  let length = 0;
  for (const character of text) {
    if (character === ' ') width += 1;
    else if (character === '\t') width += tabWidth;
    else break;
    if (width > targetWidth) break;
    length += character.length;
  }
  return length;
}

function collectTargetLines(state, tabWidth, lineToken = null) {
  if (!state?.doc || !state.selection?.ranges?.length || typeof state.languageDataAt !== 'function') return null;
  const visualTabWidth = Number.isInteger(tabWidth) && tabWidth > 0 ? tabWidth : 4;
  const linesByStart = new Map();
  let minimumVisualIndent = Number.POSITIVE_INFINITY;

  for (const range of state.selection.ranges) {
    const rangeFrom = Math.min(range.from, range.to);
    const rangeTo = Math.max(range.from, range.to);
    for (let position = rangeFrom; position <= rangeTo;) {
      const line = state.doc.lineAt(position);
      if (!linesByStart.has(line.from) && (rangeFrom === rangeTo || rangeTo > line.from)) {
        const availableTokens = lineCommentTokensAt(state, line.from);
        const token = lineToken === null ? availableTokens[0] : availableTokens.find(candidate => candidate === lineToken);
        if (typeof token !== 'string' || !token) return null;
        const leading = indentation(line.text, visualTabWidth);
        const empty = leading.length === line.length;
        const comment = line.text.slice(leading.length, leading.length + token.length) === token
          ? leading.length
          : -1;
        if (leading.length < line.length) minimumVisualIndent = Math.min(minimumVisualIndent, leading.width);
        linesByStart.set(line.from, { line, token, leading, empty, comment, single: false });
      }
      position = line.to + 1;
    }
  }

  const lines = [...linesByStart.values()].sort((left, right) => left.line.from - right.line.from);
  if (!lines.length) return null;
  if (lines.length === 1) lines[0].single = true;
  if (!Number.isFinite(minimumVisualIndent)) minimumVisualIndent = 0;
  return { lines, minimumVisualIndent, tabWidth: visualTabWidth };
}

function inlineUncommentStatus(state, tabWidth = 4) {
  for (const token of inlineCommentVariants(state)) {
    const selection = collectTargetLines(state, tabWidth, token);
    if (!selection) continue;
    const candidates = selection.lines.filter(line => line.single || !line.empty);
    if (!candidates.some(line => line.comment >= 0)) continue;
    return {
      found: true,
      all: candidates.length > 0 && candidates.every(line => line.comment >= 0),
      token,
      selection
    };
  }
  return { found: false, all: false };
}

function hasLineCommentTokenInSelection(state) {
  if (!state?.doc || !state.selection?.ranges?.length || typeof state.languageDataAt !== 'function') return false;
  const lines = new Set();
  for (const range of state.selection.ranges) {
    const rangeFrom = Math.min(range.from, range.to);
    const rangeTo = Math.max(range.from, range.to);
    for (let position = rangeFrom; position <= rangeTo;) {
      const line = state.doc.lineAt(position);
      if (!lines.has(line.from) && (rangeFrom === rangeTo || rangeTo > line.from)) {
        lines.add(line.from);
        const token = state.languageDataAt('commentTokens', line.from, 1)[0]?.line;
        if (typeof token === 'string' && token) return true;
      }
      position = line.to + 1;
    }
  }
  return false;
}

function hasBlockCommentTokenInSelection(state) {
  if (!state?.doc || !state.selection?.ranges?.length || typeof state.languageDataAt !== 'function') return false;
  const lines = new Set();
  for (const range of state.selection.ranges) {
    const rangeFrom = Math.min(range.from, range.to);
    const rangeTo = Math.max(range.from, range.to);
    for (let position = rangeFrom; position <= rangeTo;) {
      const line = state.doc.lineAt(position);
      if (!lines.has(line.from) && (rangeFrom === rangeTo || rangeTo > line.from)) {
        lines.add(line.from);
        const token = state.languageDataAt('commentTokens', line.from, 1)[0]?.block;
        if (typeof token?.open === 'string' && token.open && typeof token?.close === 'string' && token.close) return true;
      }
      position = line.to + 1;
    }
  }
  return false;
}

/**
 * CotEditor checks complete block-comment pairs before inline comments when a
 * syntax defines both styles. Probe each range separately so a partially
 * wrapped multi-selection does not get mislabeled as fully uncommentable.
 */
function blockUncommentStatus(state) {
  if (!hasLineCommentTokenInSelection(state) || !hasBlockCommentTokenInSelection(state)) {
    return { found: false, all: false };
  }

  const selection = blockCommentProbeSelection(state);
  for (const token of blockCommentVariants(state, state.selection.ranges)) {
    const matches = selection.ranges.map(range => {
      const transaction = probeBlockUncomment(state, EditorSelection.create([range]), token);
      return Boolean(transaction && transaction.newDoc.length < state.doc.length);
    });
    if (matches.some(Boolean)) {
      return {
        found: true,
        all: matches.length > 0 && matches.every(Boolean),
        token,
        selection
      };
    }
  }

  return { found: false, all: false };
}

function blockCommentByLineWouldUncomment(state) {
  let transaction = null;
  const previewView = { state, dispatch: value => { transaction = value; } };
  const changed = toggleBlockCommentByLine(previewView);
  return changed && transaction?.docChanged && transaction.state.doc.length < state.doc.length;
}

/**
 * Whether Toggle Comment will take its uncomment branch for this selection.
 * Line-comment syntax has priority; when it is unavailable, use CodeMirror's
 * block-comment-by-line command as CotEditor's block-only-language fallback.
 */
export function canUncommentToggleSelection(state) {
  const blockStatus = blockUncommentStatus(state);
  if (blockStatus.found) return blockStatus.all;

  const inlineStatus = inlineUncommentStatus(state, 4);
  if (inlineStatus.found) return inlineStatus.all;

  const selection = collectTargetLines(state, 4);
  if (selection) {
    const candidates = selection.lines.filter(line => line.single || !line.empty);
    return candidates.length > 0 && candidates.every(line => line.comment >= 0);
  }
  if (hasLineCommentTokenInSelection(state)) return false;
  return blockCommentByLineWouldUncomment(state);
}

/**
 * Toggle line comments after the minimum common visual indentation, as in
 * CotEditor's default behavior. If no target line has inline-comment syntax,
 * fall back to block comments by line. Disjoint line-comment selections
 * contribute to one shared minimum-indentation calculation.
 */
export function toggleCommentAtVisualIndent(view, tabWidth = 4, appendsSpacer = true) {
  if (!view?.state || typeof view.dispatch !== 'function') return false;
  const { state } = view;
  if (state.readOnly) return false;
  const blockStatus = blockUncommentStatus(state);
  if (blockStatus.found && blockStatus.all) {
    return applyBlockUncommentProbe(view, state, blockStatus.selection, blockStatus.token, appendsSpacer);
  }

  const inlineStatus = inlineUncommentStatus(state, tabWidth);
  const selection = !blockStatus.found && inlineStatus.found && inlineStatus.all
    ? inlineStatus.selection
    : collectTargetLines(state, tabWidth);
  if (!selection) {
    if (hasLineCommentTokenInSelection(state)) return false;
    return dispatchCommentCommand(view, toggleBlockCommentByLine, 'block', appendsSpacer);
  }
  const { lines, minimumVisualIndent, tabWidth: visualTabWidth } = selection;

  let changes;
  if (blockStatus.found || (inlineStatus.found && !inlineStatus.all)
      || lines.some(line => line.comment < 0 && (!line.empty || line.single))) {
    changes = lines
      .filter(line => line.single || !line.empty)
      .map(({ line, token }) => ({
        from: line.from + offsetAtVisualIndent(line.text, minimumVisualIndent, visualTabWidth),
        insert: `${token}${appendsSpacer ? ' ' : ''}`
      }));
  } else if (lines.some(line => line.comment >= 0)) {
    changes = lines
      .filter(line => line.comment >= 0)
      .map(({ line, comment, token }) => {
        const from = line.from + comment;
        let to = from + token.length;
        if (appendsSpacer && line.text[to - line.from] === ' ') to += 1;
        return { from, to };
      });
  } else {
    return false;
  }

  const changeSet = state.changes(changes);
  view.dispatch(state.update({ changes: changeSet, selection: state.selection.map(changeSet, 1) }));
  return true;
}

// Keep the line-specific export available for existing unit-level callers.
export const toggleLineCommentAtVisualIndent = toggleCommentAtVisualIndent;
