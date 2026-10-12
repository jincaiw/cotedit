'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Returns true when `target` is the same path as `root` or nested inside it.
 *
 * Both arguments must be absolute, normalized paths compared lexically.
 */
function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function nearestExistingDirectory(target) {
  let current = target;
  for (let depth = 0; depth < 64; depth += 1) {
    try {
      await fs.lstat(current);
      return current;
    } catch {
      // does not exist yet; keep walking up
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/**
 * Resolves `requestedPath` inside `rootPath` while tolerating a root whose own
 * path contains symbolic links (e.g. macOS `/var` -> `/private/var`, where a
 * user-supplied path stays lexical while `realpath` canonicalizes the root).
 *
 * Both the lexical forms (exactly as the caller supplied them, resolved
 * against the process working directory) and the canonical forms (realpath'd)
 * are returned, so callers can echo the user's path back while the containment
 * checks below always compare canonical paths. Targets that do not exist yet
 * (file/folder creation) are validated through their nearest existing ancestor
 * so that a symlinked parent cannot be used to escape the root.
 *
 * @param {string} rootPath - The root directory the caller selected.
 * @param {string} requestedPath - The requested absolute or relative path.
 * @param {{invalid?: string, outOfRange?: string, escaped?: string}} [messages]
 * @returns {Promise<{root: string, path: string, canonicalRoot: string, canonicalPath: string, existed: boolean}>}
 */
async function resolveWithinRoot(rootPath, requestedPath, messages = {}) {
  const invalidMessage = messages.invalid || '路径无效。';
  const outOfRangeMessage = messages.outOfRange || '路径超出已选文件夹范围。';
  const escapedMessage = messages.escaped || '路径通过符号链接离开了已选文件夹。';

  if (typeof rootPath !== 'string' || !rootPath || typeof requestedPath !== 'string' || !requestedPath) {
    throw new Error(invalidMessage);
  }

  const lexicalRoot = path.resolve(rootPath);
  const lexicalTarget = path.resolve(requestedPath);

  let canonicalRoot;
  try {
    canonicalRoot = await fs.realpath(lexicalRoot);
  } catch {
    throw new Error(invalidMessage);
  }

  const lexicallyWithin = isWithin(lexicalRoot, lexicalTarget);
  const reallyWithin = isWithin(canonicalRoot, lexicalTarget);
  if (!lexicallyWithin && !reallyWithin) throw new Error(outOfRangeMessage);

  let canonicalTarget = lexicalTarget;
  let existed = true;
  try {
    canonicalTarget = await fs.realpath(lexicalTarget);
  } catch {
    existed = false;
  }

  if (existed) {
    if (!isWithin(canonicalRoot, canonicalTarget)) throw new Error(escapedMessage);
  } else {
    // The target does not exist yet: validate the nearest existing ancestor so
    // that a symlinked parent cannot be used to escape the root.
    const ancestor = await nearestExistingDirectory(path.dirname(lexicalTarget));
    const ancestorReal = ancestor ? await fs.realpath(ancestor).catch(() => ancestor) : null;
    if (!ancestorReal || !isWithin(canonicalRoot, ancestorReal)) throw new Error(escapedMessage);
  }

  return {
    root: lexicalRoot,
    path: lexicalTarget,
    canonicalRoot,
    canonicalPath: canonicalTarget,
    existed
  };
}

module.exports = { isWithin, resolveWithinRoot };
