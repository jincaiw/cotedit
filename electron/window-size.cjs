'use strict';

const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 1280, height: 820 });
const WINDOW_SIZE_LIMITS = Object.freeze({ minWidth: 860, minHeight: 600, maxWidth: 4000, maxHeight: 4000 });

function isValidWindowSize(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Number.isInteger(value.width)
    && value.width >= WINDOW_SIZE_LIMITS.minWidth && value.width <= WINDOW_SIZE_LIMITS.maxWidth
    && Number.isInteger(value.height)
    && value.height >= WINDOW_SIZE_LIMITS.minHeight && value.height <= WINDOW_SIZE_LIMITS.maxHeight);
}

function normalizeWindowSize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_WINDOW_SIZE };
  const width = Number.isFinite(value.width) ? Math.round(value.width) : DEFAULT_WINDOW_SIZE.width;
  const height = Number.isFinite(value.height) ? Math.round(value.height) : DEFAULT_WINDOW_SIZE.height;
  return {
    width: Math.max(WINDOW_SIZE_LIMITS.minWidth, Math.min(WINDOW_SIZE_LIMITS.maxWidth, width)),
    height: Math.max(WINDOW_SIZE_LIMITS.minHeight, Math.min(WINDOW_SIZE_LIMITS.maxHeight, height))
  };
}

function applyWindowSize(window, size) {
  if (!window || typeof window.setSize !== 'function' || window.isDestroyed?.() === true || !isValidWindowSize(size)) return false;
  window.setSize(size.width, size.height);
  return true;
}

module.exports = { DEFAULT_WINDOW_SIZE, WINDOW_SIZE_LIMITS, applyWindowSize, isValidWindowSize, normalizeWindowSize };
