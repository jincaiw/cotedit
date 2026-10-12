'use strict';

const path = require('node:path');
const MAX_RECENT_DOCUMENTS = 10;

function normalizeRecentDocuments(value, platform = process.platform) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const documents = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') continue;
    const resolved = path.resolve(item);
    const key = platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    documents.push(resolved);
    if (documents.length === MAX_RECENT_DOCUMENTS) break;
  }
  return documents;
}

function addRecentDocument(documents, filePath, platform = process.platform) {
  if (typeof filePath !== 'string' || filePath.trim() === '') return normalizeRecentDocuments(documents, platform);
  return normalizeRecentDocuments([path.resolve(filePath), ...(Array.isArray(documents) ? documents : [])], platform);
}

async function filterExistingRecentDocuments(documents, isRegularFile) {
  const normalized = normalizeRecentDocuments(documents);
  const available = await Promise.all(normalized.map(async filePath => {
    try { return await isRegularFile(filePath) === true; }
    catch { return false; }
  }));
  return normalized.filter((_filePath, index) => available[index]);
}

module.exports = { MAX_RECENT_DOCUMENTS, normalizeRecentDocuments, addRecentDocument, filterExistingRecentDocuments };
