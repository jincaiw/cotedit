'use strict';

const MAX_EXTERNAL_WEB_URL_LENGTH = 4096;

function normalizeExternalWebUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_EXTERNAL_WEB_URL_LENGTH || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:')
      || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

module.exports = { normalizeExternalWebUrl };
