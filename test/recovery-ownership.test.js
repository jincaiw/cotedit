import test from 'node:test';
import assert from 'node:assert/strict';
import recoveryOwnership from '../electron/recovery-ownership.cjs';

const { createRecoveryOwnership } = recoveryOwnership;

test('recovery ownership is isolated across windows and annotates only open draft IDs', () => {
  const ownership = createRecoveryOwnership();
  ownership.claim(1, [{ id: 'draft-a' }, { id: 'draft-shared' }]);
  ownership.claim(2, [{ id: 'draft-b' }, { id: 'draft-shared' }]);
  const input = [{ id: 'draft-a' }, { id: 'draft-b' }, { id: 'draft-shared' }, { id: 'draft-c' }];
  assert.deepEqual(ownership.annotate(input).map(item => [item.id, item.inUse]), [
    ['draft-a', true], ['draft-b', true], ['draft-shared', true], ['draft-c', false]
  ]);
  assert.deepEqual(input.map(item => Object.hasOwn(item, 'inUse')), [false, false, false, false], 'annotation must not mutate caller data');
  assert.deepEqual([...ownership.activeIds()].sort(), ['draft-a', 'draft-b', 'draft-shared']);
});

test('release frees only the target renderer owner and is idempotent', () => {
  const ownership = createRecoveryOwnership();
  ownership.claim('first', [{ id: 'draft-a' }]);
  ownership.claim('second', [{ id: 'draft-b' }]);
  assert.equal(ownership.release('first'), true);
  assert.equal(ownership.release('first'), false);
  assert.deepEqual(ownership.annotate([{ id: 'draft-a' }, { id: 'draft-b' }]).map(item => item.inUse), [false, true]);
  assert.equal(ownership.release('second'), true);
  assert.deepEqual([...ownership.activeIds()], []);
});

test('empty snapshots still claim an owner until that renderer lifecycle is released', () => {
  const ownership = createRecoveryOwnership();
  ownership.claim(3, []);
  assert.deepEqual([...ownership.activeIds()], []);
  assert.equal(ownership.release(3), true);
  assert.equal(ownership.release(3), false);
});
