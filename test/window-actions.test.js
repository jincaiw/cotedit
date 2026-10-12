import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bringAllWindowsToFront, toggleAlwaysOnTop } = require('../electron/window-actions.cjs');

function mockWindow({ minimized = false, destroyed = false, alwaysOnTop = false } = {}) {
  const calls = [];
  let top = alwaysOnTop;
  return {
    calls,
    isDestroyed: () => destroyed,
    isMinimized: () => minimized,
    isAlwaysOnTop: () => top,
    setAlwaysOnTop: value => { top = value; calls.push(['setAlwaysOnTop', value]); },
    restore: () => calls.push(['restore']),
    show: () => calls.push(['show']),
    focus: () => calls.push(['focus'])
  };
}

test('window pinning toggles the actual native state and ignores destroyed windows', () => {
  const window = mockWindow();
  assert.equal(toggleAlwaysOnTop(window), true);
  assert.equal(window.isAlwaysOnTop(), true);
  assert.equal(toggleAlwaysOnTop(window), false);
  assert.equal(window.isAlwaysOnTop(), false);
  assert.equal(toggleAlwaysOnTop(mockWindow({ destroyed: true })), false);
});

test('Bring All to Front restores, shows, then focuses all live app windows', () => {
  const minimized = mockWindow({ minimized: true });
  const visible = mockWindow();
  const destroyed = mockWindow({ destroyed: true });
  assert.equal(bringAllWindowsToFront([minimized, visible, destroyed]), 2);
  assert.deepEqual(minimized.calls, [['restore'], ['show']]);
  assert.deepEqual(visible.calls, [['show'], ['focus']]);
  assert.equal(bringAllWindowsToFront([destroyed]), 0);
  assert.equal(bringAllWindowsToFront([]), 0);
});
