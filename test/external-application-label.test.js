import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatExternalApplicationLabel } from '../lib/external-application-label.js';

const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('external editor menu includes versions when duplicate names include the default app', () => {
  const applications = [
    { id: 'editor.default', displayName: 'Editor', version: '5.2', isDefault: true },
    { id: 'editor.other', displayName: 'Editor', version: '4.8', isDefault: false }
  ];

  assert.equal(formatExternalApplicationLabel(applications[0], applications, { isDefault: true }), 'Editor (5.2)（默认）');
  assert.equal(formatExternalApplicationLabel(applications[1], applications), 'Editor (4.8)');
});

test('unique application names stay concise even when version metadata exists', () => {
  const application = { displayName: 'CotEdit', version: '0.5.16' };
  assert.equal(formatExternalApplicationLabel(application, [application]), 'CotEdit');
  assert.equal(formatExternalApplicationLabel(application, [application], { isDefault: true }), 'CotEdit（默认）');
});

test('duplicate names compare after trimming, Unicode normalization, and case folding', () => {
  const applications = [
    { displayName: '  Résumé  ', version: '2' },
    { displayName: 're\u0301sume\u0301', version: '1' }
  ];
  assert.equal(formatExternalApplicationLabel(applications[0], applications), 'Résumé (2)');
  assert.equal(formatExternalApplicationLabel(applications[1], applications), 'résumé (1)');
});

test('duplicate names without version metadata remain safe and visibly identify the default', () => {
  const applications = [
    { displayName: 'Editor' },
    { displayName: 'Editor', version: '  ' }
  ];
  assert.equal(formatExternalApplicationLabel(applications[0], applications, { isDefault: true }), 'Editor（默认）');
});

test('folder preview uses the same disambiguated labels for visible and accessible default-app text', () => {
  assert.match(renderer, /formatExternalApplicationLabel\(defaultApplication, applications, \{ isDefault: true \}\)/);
  assert.match(renderer, /formatExternalApplicationLabel\(application, applications\)/);
  assert.match(renderer, /defaultButton\.setAttribute\('aria-label', `使用系统默认应用打开：\$\{label\}`\)/);
  assert.match(renderer, /defaultButton\.title = label/);
});
