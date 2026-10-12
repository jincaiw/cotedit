import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const windowsInstaller = readFileSync(new URL('../build/installer.nsh', import.meta.url), 'utf8');

test('macOS declares CotEditor-compatible text and source document extensions', () => {
  const associations = packageJson.build.mac.fileAssociations;
  assert.equal(associations.length, 1);
  const [association] = associations;
  assert.equal(association.name, 'Text document');
  assert.equal(association.role, 'Editor');
  assert.equal(association.rank, 'Default');
  assert.ok(association.ext.length >= 80);
  assert.equal(new Set(association.ext).size, association.ext.length);
  for (const extension of ['txt', 'md', 'c', 'cpp', 'js', 'json', 'geojson', 'py', 'swift', 'toml', 'yaml']) {
    assert.ok(association.ext.includes(extension), `missing .${extension}`);
  }
});

test('Linux advertises standard text MIME types without changing Windows install scope', () => {
  const mimeTypes = packageJson.build.linux.mimeTypes;
  assert.ok(mimeTypes.includes('text/plain'));
  assert.ok(mimeTypes.includes('text/markdown'));
  assert.ok(mimeTypes.includes('application/geo+json'));
  assert.ok(mimeTypes.includes('application/json'));
  assert.ok(mimeTypes.includes('text/x-python'));
  assert.equal(new Set(mimeTypes).size, mimeTypes.length);
  assert.equal(packageJson.build.win.fileAssociations, undefined);
  assert.notEqual(packageJson.build.nsis.perMachine, true);
});

test('Windows adds current-user Open With entries without replacing default handlers', () => {
  const actualExtensions = [...windowsInstaller.matchAll(/^\s*!insertmacro CotEditOpenWithExtension ([^\s]+) \$\{MODE\}$/gm)]
    .map(([, extension]) => extension)
    .sort();
  const expectedExtensions = [...packageJson.build.mac.fileAssociations[0].ext].sort();
  assert.deepEqual(actualExtensions, expectedExtensions);
  assert.match(windowsInstaller, /WriteRegNone HKCU "Software\\Classes\\\.\$\{EXT\}\\OpenWithProgids"/);
  assert.match(windowsInstaller, /WriteRegStr HKCU "Software\\Classes\\Applications\\\$\{APP_EXECUTABLE_FILENAME\}\\SupportedTypes"/);
  assert.doesNotMatch(windowsInstaller, /WriteRegStr HKCU "Software\\Classes\\\.\$\{EXT\}" ""/);
  assert.match(windowsInstaller, /ReadRegStr \$R1 HKCU/);
  assert.match(windowsInstaller, /StrCmp \$R1 \$R0 cotedit_cleanup_matches cotedit_cleanup_done/);
  assert.match(windowsInstaller, /DeleteRegValue HKCU/);
});
