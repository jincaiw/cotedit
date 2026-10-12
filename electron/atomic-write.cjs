'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { encodeText } = require('./codec.cjs');

/** Replace a text file atomically while retaining its ordinary POSIX mode bits. */
async function atomicWrite(filePath, text, encoding = 'utf8', bom = false) {
  const dir = path.dirname(filePath);
  const temp = path.join(dir, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const buffer = encodeText(text, encoding, bom);
  let existingMode = null;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile()) existingMode = stat.mode & 0o777;
    else throw new Error('目标路径不是普通文件。');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    await fs.writeFile(temp, buffer, { flag: 'wx', mode: existingMode ?? 0o600 });
    if (existingMode != null) await fs.chmod(temp, existingMode);
    await fs.rename(temp, filePath);
    return buffer.length;
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { atomicWrite };
