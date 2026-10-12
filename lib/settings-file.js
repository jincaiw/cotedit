import { normalizeSettings } from './settings.js';

export const SETTINGS_FILE_FORMAT = 'cotedit-settings';
export const SETTINGS_FILE_VERSION = 1;
export const MAX_SETTINGS_FILE_BYTES = 64 * 1024;

export function serializeSettingsFile(settings) {
  const payload = {
    format: SETTINGS_FILE_FORMAT,
    version: SETTINGS_FILE_VERSION,
    settings: normalizeSettings(settings)
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseSettingsFile(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).byteLength > MAX_SETTINGS_FILE_BYTES) {
    throw new Error('设置文件过大或格式无效。');
  }
  let payload;
  try { payload = JSON.parse(source); }
  catch { throw new Error('设置文件不是有效的 JSON。'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || payload.format !== SETTINGS_FILE_FORMAT || payload.version !== SETTINGS_FILE_VERSION
      || !payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
    throw new Error('设置文件格式或版本不受支持。');
  }
  return normalizeSettings(payload.settings);
}
