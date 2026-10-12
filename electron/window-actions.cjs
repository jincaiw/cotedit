'use strict';

function toggleAlwaysOnTop(window) {
  if (!window || window.isDestroyed()) return false;
  const enabled = !window.isAlwaysOnTop();
  window.setAlwaysOnTop(enabled);
  return enabled;
}

function bringAllWindowsToFront(windows = []) {
  const liveWindows = Array.from(windows || []).filter(window => window && !window.isDestroyed());
  if (!liveWindows.length) return 0;

  for (const window of liveWindows) {
    if (window.isMinimized()) window.restore();
    window.show();
  }
  liveWindows.at(-1).focus();
  return liveWindows.length;
}

module.exports = { bringAllWindowsToFront, toggleAlwaysOnTop };
