'use strict';

const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000;

function normalizeFileTimestamp(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_DATE_MILLISECONDS) return null;
  return Math.trunc(value);
}

/** Extract portable creation/modification timestamps from an existing local-file stat result. */
function documentFileTimestamps(stat) {
  return {
    fileCreatedAtMs: normalizeFileTimestamp(stat?.birthtimeMs),
    fileModifiedAtMs: normalizeFileTimestamp(stat?.mtimeMs)
  };
}

function permissionClass(bits, specialBit, specialSymbol) {
  const executable = (bits & 0o1) !== 0;
  return `${bits & 0o4 ? 'r' : '-'}${bits & 0o2 ? 'w' : '-'}${specialBit
    ? (executable ? specialSymbol.toLowerCase() : specialSymbol.toUpperCase())
    : (executable ? 'x' : '-')}`;
}

/** Format the POSIX permission bits from an existing stat result; Windows mode bits are not POSIX ACLs. */
function documentFilePermissions(stat, platform = process.platform) {
  if (platform === 'win32') return null;
  const mode = stat?.mode;
  if (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o177777) return null;

  const mask = mode & 0o7777;
  const special = (mask & 0o7000) !== 0;
  const octal = mask.toString(8).padStart(special ? 4 : 3, '0');
  const owner = permissionClass((mask >>> 6) & 0o7, (mask & 0o4000) !== 0, 's');
  const group = permissionClass((mask >>> 3) & 0o7, (mask & 0o2000) !== 0, 's');
  const others = permissionClass(mask & 0o7, (mask & 0o1000) !== 0, 't');
  return `${octal} (-${owner}${group}${others})`;
}

/** Return numeric POSIX owner/group IDs from the same local-file stat snapshot. */
function documentFileOwnerIds(stat, platform = process.platform) {
  if (platform === 'win32') return null;
  const uid = stat?.uid;
  const gid = stat?.gid;
  if (!Number.isSafeInteger(uid) || uid < 0 || !Number.isSafeInteger(gid) || gid < 0) return null;
  return { uid, gid };
}

module.exports = { documentFileOwnerIds, documentFilePermissions, documentFileTimestamps, normalizeFileTimestamp };
