export const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 1280, height: 820 });
export const WINDOW_SIZE_STORAGE_KEY = 'cotedit.last-window-size.v1';
const MIN_WIDTH = 860;
const MIN_HEIGHT = 600;
const MAX_WIDTH = 4000;
const MAX_HEIGHT = 4000;

function clampDimension(value, minimum, maximum, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function normalizeLastWindowSize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_WINDOW_SIZE };
  return {
    width: clampDimension(value.width, MIN_WIDTH, MAX_WIDTH, DEFAULT_WINDOW_SIZE.width),
    height: clampDimension(value.height, MIN_HEIGHT, MAX_HEIGHT, DEFAULT_WINDOW_SIZE.height)
  };
}

export function resolveWindowSize(preferences, lastWindowSize) {
  const previous = normalizeLastWindowSize(lastWindowSize);
  const configured = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  return {
    width: clampDimension(configured.width, MIN_WIDTH, MAX_WIDTH, previous.width),
    height: clampDimension(configured.height, MIN_HEIGHT, MAX_HEIGHT, previous.height)
  };
}

export function readLastWindowSize(storage) {
  try {
    return normalizeLastWindowSize(JSON.parse(storage.getItem(WINDOW_SIZE_STORAGE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_WINDOW_SIZE };
  }
}

export function rememberLastWindowSize(storage, value) {
  if (!storage || typeof storage.setItem !== 'function' || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!Number.isInteger(value.width) || value.width < MIN_WIDTH || value.width > MAX_WIDTH
      || !Number.isInteger(value.height) || value.height < MIN_HEIGHT || value.height > MAX_HEIGHT) return false;
  try {
    storage.setItem(WINDOW_SIZE_STORAGE_KEY, JSON.stringify({ width: value.width, height: value.height }));
    return true;
  } catch {
    return false;
  }
}
