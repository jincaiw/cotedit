import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import recoveryStore from '../electron/recovery-store.cjs';

const { createRecoveryStore, MAX_DRAFTS_PER_WINDOW, MAX_TOTAL_DRAFTS, isDirtyDraft } = recoveryStore;

async function withStore(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cotedit-recovery-test-'));
  const file = path.join(directory, 'recovery-drafts-v1.json.gz');
  try { await run(createRecoveryStore(file), { directory, file }); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

function draft(id, text, extra = {}) {
  return {
    id,
    name: `${id}.txt`,
    text,
    savedText: '',
    language: 'plaintext',
    encoding: 'utf8',
    savedEncoding: 'utf8',
    eol: 'LF',
    savedEol: 'LF',
    lineEndings: [],
    savedLineEndings: [],
    bom: false,
    savedBom: false,
    preventEditing: false,
    writingDirection: 'ltr',
    ...extra
  };
}

test('writes compressed recovery snapshots atomically and reloads only validated metadata', async () => {
  await withStore(async (store, { file }) => {
    const input = draft('draft-a', 'unsaved text', { savedText: 'saved text', writingDirection: 'rtl', path: '/private/source.txt' });
    const listed = await store.replaceWindow('1', [input]);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].text, 'unsaved text');
    assert.equal(listed[0].writingDirection, 'rtl');
    assert.equal(listed[0].windowId, '1');
    assert.equal(Object.hasOwn(listed[0], 'path'), false, 'the recovery store must not retain original file paths');
    assert.ok(listed[0].updatedAt);
    const bytes = await fs.readFile(file);
    assert.equal(bytes[0], 0x1f);
    assert.equal(bytes[1], 0x8b);
    const restored = await createRecoveryStore(file).list();
    assert.equal(restored.length, 1);
    assert.equal(restored[0].savedText, 'saved text');
    assert.equal(restored[0].text, 'unsaved text');
    if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  });
});

test('replacing a window snapshot removes its saved/discarded drafts but preserves other windows', async () => {
  await withStore(async store => {
    await store.replaceWindow('1', [draft('a', 'edited-a'), draft('b', 'edited-b')]);
    await store.replaceWindow('2', [draft('c', 'edited-c')]);
    await store.replaceWindow('1', [draft('a', 'edited-a-again')]);
    const records = await store.list();
    assert.deepEqual(records.map(item => [item.id, item.windowId]).sort(), [['a', '1'], ['c', '2']]);
    assert.equal(records.find(item => item.id === 'a').text, 'edited-a-again');
  });
});

test('unchanged snapshots preserve updatedAt and content changes advance it', async () => {
  await withStore(async store => {
    await store.replaceWindow('1', [draft('a', 'text')]);
    const first = (await store.list())[0].updatedAt;
    await store.replaceWindow('1', [draft('a', 'text')]);
    assert.equal((await store.list())[0].updatedAt, first);
    await new Promise(resolve => setTimeout(resolve, 5));
    await store.replaceWindow('1', [draft('a', 'changed')]);
    assert.ok((await store.list())[0].updatedAt >= first);
    assert.equal((await store.list())[0].text, 'changed');
  });
});

test('imports legacy per-window sessions idempotently without replacing an existing newer record', async () => {
  await withStore(async store => {
    const legacy = [{ windowId: 'main', drafts: [{ name: 'old.txt', text: 'old', savedText: '' }] }];
    const first = await store.importLegacy(legacy);
    assert.equal(first.imported, 1);
    assert.equal(first.drafts.length, 1);
    const id = first.drafts[0].id;
    await store.replaceWindow('main', [draft(id, 'newer', { savedText: 'old' })]);
    const second = await store.importLegacy(legacy);
    assert.equal(second.imported, 0);
    assert.equal(second.drafts.length, 1);
    assert.equal(second.drafts[0].text, 'newer');
  });
});

test('explicit removal and clear delete only requested recovery entries', async () => {
  await withStore(async store => {
    await store.replaceWindow('1', [draft('a', 'a'), draft('b', 'b')]);
    await store.remove(['a']);
    assert.deepEqual((await store.list()).map(item => item.id), ['b']);
    await store.clear();
    assert.deepEqual(await store.list(), []);
  });
});

test('enforces the existing per-window limit and global count without evicting drafts', async () => {
  await withStore(async store => {
    const tooManyInWindow = Array.from({ length: MAX_DRAFTS_PER_WINDOW + 1 }, (_, index) => draft(`w-${index}`, `text-${index}`));
    await assert.rejects(store.replaceWindow('1', tooManyInWindow), error => error.code === 'RECOVERY_LIMIT');
    assert.deepEqual(await store.list(), []);

    const sessions = Array.from({ length: Math.ceil((MAX_TOTAL_DRAFTS + 1) / MAX_DRAFTS_PER_WINDOW) }, (_, index) => ({
      windowId: `w${index}`,
      drafts: Array.from({ length: Math.min(MAX_DRAFTS_PER_WINDOW, MAX_TOTAL_DRAFTS + 1 - index * MAX_DRAFTS_PER_WINDOW) }, (_, itemIndex) => draft(`w${index}-d${itemIndex}`, 'x'))
    }));
    await assert.rejects(store.importLegacy(sessions), error => error.code === 'RECOVERY_LIMIT');
    assert.deepEqual(await store.list(), []);
  });
});

test('rejects clean records and malformed identifiers instead of persisting them', async () => {
  await withStore(async store => {
    const clean = draft('clean', 'same', { savedText: 'same' });
    assert.equal(isDirtyDraft(clean), false);
    await assert.rejects(store.replaceWindow('1', [clean]));
    await assert.rejects(store.replaceWindow('../escape', [draft('a', 'x')]));
    assert.deepEqual(await store.list(), []);
  });
});

test('preserves a corrupt recovery file and refuses to overwrite it', async () => {
  await withStore(async (store, { file }) => {
    const corrupt = Buffer.from('not gzip');
    await fs.writeFile(file, corrupt);
    await assert.rejects(store.list(), error => error.code === 'RECOVERY_CORRUPT');
    await assert.rejects(store.replaceWindow('1', [draft('a', 'x')]), error => error.code === 'RECOVERY_CORRUPT');
    assert.deepEqual(await fs.readFile(file), corrupt);
  });
});
