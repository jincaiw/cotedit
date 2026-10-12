import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CUSTOM_COT_SYNTAXES, mergeImportedCotSyntaxes } from '../lib/cot-syntax-import.js';

const syntax = (id, label = id) => ({ id: `cot-syntax-${id}`, name: label });

test('merges imported syntax packages without mutating input and moves updated IDs to the end', () => {
  const existing = [syntax('one'), syntax('two')];
  const imported = [syntax('one', 'One updated'), syntax('three')];
  const merged = mergeImportedCotSyntaxes(existing, imported, { rejectOverflow: true });
  assert.deepEqual(merged.map(item => [item.id, item.name]), [
    ['cot-syntax-two', 'two'],
    ['cot-syntax-one', 'One updated'],
    ['cot-syntax-three', 'three']
  ]);
  assert.deepEqual(existing.map(item => item.id), ['cot-syntax-one', 'cot-syntax-two']);
  assert.equal(existing[1].name, 'two');
});

test('rejects an over-capacity dropped batch atomically while the existing list remains unchanged', () => {
  const existing = Array.from({ length: MAX_CUSTOM_COT_SYNTAXES }, (_, index) => syntax(`old-${index}`));
  const before = existing.slice();
  assert.throws(() => mergeImportedCotSyntaxes(existing, [syntax('new')], { rejectOverflow: true }), /现有列表保持不变/);
  assert.deepEqual(existing, before);
  assert.equal(mergeImportedCotSyntaxes(existing, [syntax('old-0', 'Updated')], { rejectOverflow: true }).length, MAX_CUSTOM_COT_SYNTAXES);
});

test('rejects malformed imported identifiers and empty batches', () => {
  assert.throws(() => mergeImportedCotSyntaxes([], []), /批次无效/);
  assert.throws(() => mergeImportedCotSyntaxes([], [{ id: '../outside' }]), /格式无效/);
});
