import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createExternalApplicationDialogOptions } = require('../electron/external-application-dialog.cjs');
const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');

test('macOS external-application chooser starts in Applications and selects app bundles as packages', () => {
  assert.deepEqual(createExternalApplicationDialogOptions('darwin'), {
    title: '选择要打开文件的应用',
    buttonLabel: '使用此应用打开',
    properties: ['openFile'],
    defaultPath: '/Applications',
    treatPackageAsDirectory: false,
    filters: [{ name: '应用程序', extensions: ['app'] }]
  });
});

test('Windows filters for executable applications while Linux keeps its native picker unrestricted', () => {
  const expected = {
    title: '选择要打开文件的应用',
    buttonLabel: '使用此应用打开',
    properties: ['openFile']
  };
  assert.deepEqual(createExternalApplicationDialogOptions('win32'), {
    ...expected,
    filters: [{ name: '应用程序', extensions: ['exe'] }]
  });
  assert.deepEqual(createExternalApplicationDialogOptions('linux'), expected);
});

test('directory application picker passes the platform options into the native chooser', () => {
  assert.match(main, /createExternalApplicationDialogOptions\s*\}\s*=\s*require\('\.\/external-application-dialog\.cjs'\)/);
  assert.match(main, /const options = createExternalApplicationDialogOptions\(\);[\s\S]*?dialog\.showOpenDialog\(windowForEvent\(event\), options\)/);
});
