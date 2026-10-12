'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { resolveWithinRoot } = require('./root-path.cjs');

const MAX_UNIQUE_NAME_ATTEMPTS = 10000;
function isAlreadyExistsError(error) {
  if (!error) return false;
  if (error.code === 'EEXIST') return true;
  // Some sandboxes wrap filesystem errors and replace `code` while keeping the
  // original message; fall back to the textual marker so exclusive creation
  // still retries with the next unique name.
  return /EEXIST/.test(String(error.message || ''));
}
const DEFAULT_FILE_EXTENSION = 'txt';
const FILE_EXTENSION = /^[a-z0-9_+-]{1,32}$/i;
const DEFAULT_NAMES = Object.freeze({
  cs: Object.freeze({ file: 'Bez názvu', folder: 'Bez názvu' }),
  de: Object.freeze({ file: 'Ohne Titel', folder: 'Neuer Ordner' }),
  en: Object.freeze({ file: 'Untitled', folder: 'untitled folder' }),
  es: Object.freeze({ file: 'Sin título', folder: 'carpeta sin título' }),
  fr: Object.freeze({ file: 'Sans titre', folder: 'dossier sans titre' }),
  hi: Object.freeze({ file: 'अनामांकित', folder: 'शीर्षकहीन फ़ोल्डर' }),
  it: Object.freeze({ file: 'Senza titolo', folder: 'cartella senza nome' }),
  ja: Object.freeze({ file: '名称未設定', folder: '名称未設定フォルダ' }),
  ko: Object.freeze({ file: '무제', folder: '무제 폴더' }),
  nl: Object.freeze({ file: 'Naamloos', folder: 'naamloze map' }),
  pl: Object.freeze({ file: 'bez nazwy', folder: 'folder bez nazwy' }),
  pt: Object.freeze({ file: 'Sem Título', folder: 'pasta sem título' }),
  ru: Object.freeze({ file: 'Без названия', folder: 'Новая папка' }),
  tr: Object.freeze({ file: 'Adsız', folder: 'adsız klasör' }),
  uk: Object.freeze({ file: 'Без назви', folder: 'безіменна папка' }),
  'zh-Hans': Object.freeze({ file: '未命名', folder: '未命名文件夹' }),
  'zh-Hant': Object.freeze({ file: '未命名', folder: '未命名檔案夾' }),
  'zh-HK': Object.freeze({ file: '未命名', folder: '未命名資料夾' })
});

function defaultNamesForLocale(locale) {
  const parts = typeof locale === 'string'
    ? locale.trim().replaceAll('_', '-').split('-').filter(Boolean)
    : [];
  const language = parts[0]?.toLowerCase();
  if (language === 'zh') {
    const subtags = parts.slice(1).map(part => part.toLowerCase());
    if (subtags.includes('hant')) return DEFAULT_NAMES['zh-Hant'];
    if (subtags.includes('hans')) return DEFAULT_NAMES['zh-Hans'];
    const region = parts.slice(1).find(part => /^[a-z]{2}$/i.test(part))?.toUpperCase();
    if (region === 'HK' || region === 'MO') return DEFAULT_NAMES['zh-HK'];
    if (region === 'TW') return DEFAULT_NAMES['zh-Hant'];
    return DEFAULT_NAMES['zh-Hans'];
  }
  return DEFAULT_NAMES[language] || DEFAULT_NAMES.en;
}

async function resolveDirectoryInRoot(rootPath, requestedPath) {
  const resolved = await resolveWithinRoot(rootPath, requestedPath, {
    invalid: '文件夹路径无效。',
    outOfRange: '操作路径超出已选文件夹范围。',
    escaped: '操作路径通过符号链接离开了已选文件夹。'
  });
  const stat = await fs.stat(resolved.path);
  if (!stat.isDirectory()) throw new Error('所选路径不是文件夹。');
  return { root: resolved.root, path: resolved.path };
}

async function createFileInRoot(rootPath, requestedDirectory, locale = 'en', extension = DEFAULT_FILE_EXTENSION) {
  const parent = await resolveDirectoryInRoot(rootPath, requestedDirectory);
  const { file: baseName } = defaultNamesForLocale(locale);
  const safeExtension = typeof extension === 'string' && FILE_EXTENSION.test(extension)
    ? extension.toLowerCase()
    : DEFAULT_FILE_EXTENSION;
  for (let index = 1; index <= MAX_UNIQUE_NAME_ATTEMPTS; index++) {
    const name = `${baseName}${index === 1 ? '' : ` ${index}`}.${safeExtension}`;
    const filePath = path.join(parent.path, name);
    let handle;
    try {
      handle = await fs.open(filePath, 'wx', 0o600);
      await handle.close();
      return { kind: 'file', name, path: filePath, parentPath: parent.path };
    } catch (error) {
      await handle?.close().catch(() => {});
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }
  }
  throw new Error('无法为新文件分配不重复的名称。');
}

async function createFolderInRoot(rootPath, requestedDirectory, locale = 'en') {
  const parent = await resolveDirectoryInRoot(rootPath, requestedDirectory);
  const { folder: baseName } = defaultNamesForLocale(locale);
  for (let index = 1; index <= MAX_UNIQUE_NAME_ATTEMPTS; index++) {
    const name = index === 1 ? baseName : `${baseName} ${index}`;
    const folderPath = path.join(parent.path, name);
    try {
      await fs.mkdir(folderPath, { mode: 0o755 });
      return { kind: 'directory', name, path: folderPath, parentPath: parent.path };
    } catch (error) {
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }
  }
  throw new Error('无法为新文件夹分配不重复的名称。');
}

module.exports = { createFileInRoot, createFolderInRoot, resolveDirectoryInRoot };
