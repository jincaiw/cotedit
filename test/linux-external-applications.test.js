import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';

const require = createRequire(import.meta.url);
const {
  applicationDirectories,
  contentTypeFromGioInfo,
  listExternalApplicationsInRoot,
  openFileWithRegisteredApplicationInRoot,
  parseDesktopEntry,
  parseGioMimeApplications
} = require('../electron/linux-external-applications.cjs');

const GIO_MIME_TEXT = [
  'Default application for “text/plain”: org.example.zulu.desktop',
  'Registered applications:',
  'org.example.zulu.desktop',
  'org.example.alpha.desktop',
  'tools-notes.desktop',
  'Recommended applications:',
  'org.example.alpha.desktop'
].join('\n');

async function withFixture(callback) {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'cotedit-registered-apps-'));
  const root = path.join(temporaryDirectory, 'workspace');
  const filePath = path.join(root, 'notes.txt');
  const dataHome = path.join(temporaryDirectory, 'data');
  const applicationsDirectory = path.join(dataHome, 'applications');
  const env = { XDG_DATA_HOME: dataHome, XDG_DATA_DIRS: path.join(temporaryDirectory, 'system-data') };
  await mkdir(root, { recursive: true });
  await mkdir(path.join(applicationsDirectory, 'tools'), { recursive: true });
  await writeFile(filePath, 'hello\n', 'utf8');
  await writeFile(path.join(applicationsDirectory, 'org.example.zulu.desktop'), [
    '[Desktop Entry]', 'Type=Application', 'Name=Zulu Editor', 'Name[zh_CN]=斑点编辑器', 'Version=3.2', 'Exec=/bin/true %f', ''
  ].join('\n'));
  await writeFile(path.join(applicationsDirectory, 'org.example.alpha.desktop'), [
    '[Desktop Entry]', 'Type=Application', 'Name=Alpha Editor', 'Version=1.0', 'Exec=/bin/true %f', ''
  ].join('\n'));
  await writeFile(path.join(applicationsDirectory, 'tools', 'notes.desktop'), [
    '[Desktop Entry]', 'Type=Application', 'Name=Beta Editor', 'Version=2.1', 'Exec=/bin/true %f', ''
  ].join('\n'));
  const execFileImpl = (executable, args, options, callback) => {
    assert.equal(executable, 'gio');
    assert.equal(options.shell, false);
    assert.equal(options.LC_ALL, undefined);
    assert.equal(options.env.LC_ALL, 'C');
    const result = args[0] === 'info'
      ? `uri: file://${filePath}\nattributes:\n  standard::content-type: text/plain\n`
      : GIO_MIME_TEXT;
    queueMicrotask(() => callback(null, result, ''));
    return {};
  };
  try {
    await callback({ temporaryDirectory, root, filePath, dataHome, applicationsDirectory, env, execFileImpl });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

test('parses GIO default and registered desktop IDs in stable unique order', () => {
  const parsed = parseGioMimeApplications(GIO_MIME_TEXT);
  assert.equal(parsed.defaultId, 'org.example.zulu.desktop');
  assert.deepEqual(parsed.ids, ['org.example.zulu.desktop', 'org.example.alpha.desktop', 'tools-notes.desktop']);
  assert.deepEqual(parseGioMimeApplications('Registered applications:\nother-app.desktop\n'), {
    defaultId: null,
    ids: ['other-app.desktop']
  });
  assert.deepEqual(parseGioMimeApplications('Default application for “x”: ../bad.desktop\n'), {
    defaultId: null,
    ids: []
  });
});

test('parses localized desktop names and rejects hidden, non-application, or malformed entries', () => {
  const metadata = parseDesktopEntry([
    '[Desktop Entry]', 'Type=Application', 'Name=Default Name', 'Name[zh_CN]=中文\\s编辑器',
    'Version=4.7', 'Exec=/bin/true %f', '[Desktop Action NewWindow]', 'Name=Ignored', ''
  ].join('\n'), 'zh-CN');
  assert.deepEqual(metadata, { displayName: '中文 编辑器', version: '4.7' });
  assert.equal(parseDesktopEntry('[Desktop Entry]\nType=Application\nName=Hidden\nHidden=true\n'), null);
  assert.equal(parseDesktopEntry('[Desktop Entry]\nType=Application\nName=Hidden\nNoDisplay=true\n'), null);
  assert.equal(parseDesktopEntry('[Desktop Entry]\nType=Link\nName=Web\n'), null);
  assert.equal(parseDesktopEntry('[Desktop Entry]\nType=Application\nExec=/bin/true\n'), null);
});

test('uses absolute XDG application directories with user data precedence', () => {
  assert.deepEqual(applicationDirectories({
    XDG_DATA_HOME: '/home/example/.local/share',
    XDG_DATA_DIRS: '/opt/share:/usr/share'
  }, '/ignored'), [
    '/home/example/.local/share/applications', '/opt/share/applications', '/usr/share/applications'
  ]);
  assert.deepEqual(applicationDirectories({ XDG_DATA_HOME: 'relative', XDG_DATA_DIRS: 'relative' }, '/home/example'), [
    '/home/example/.local/share/applications'
  ]);
});

test('parses only a valid GIO content-type attribute', () => {
  assert.equal(contentTypeFromGioInfo('attributes:\n  standard::content-type: text/plain\n'), 'text/plain');
  assert.equal(contentTypeFromGioInfo('standard::content-type: ../../bad\n'), null);
  assert.equal(contentTypeFromGioInfo('standard::content-type: text/plain extra\n'), null);
});

test('lists the default Linux application first and sorts remaining names by locale', async () => {
  await withFixture(async fixture => {
    const listed = await listExternalApplicationsInRoot(fixture.root, fixture.filePath, {
      platform: 'linux', env: fixture.env, home: fixture.temporaryDirectory, locale: 'zh-CN', execFileImpl: fixture.execFileImpl
    });
    assert.deepEqual(listed.map(({ id, isDefault }) => [id, isDefault]), [
      ['org.example.zulu.desktop', true],
      ['org.example.alpha.desktop', false],
      ['tools-notes.desktop', false]
    ]);
    assert.equal(listed[0].displayName, '斑点编辑器');
    assert.equal(listed[0].version, '3.2');
    assert.equal(Object.hasOwn(listed[0], 'desktopPath'), false);
  });
});

test('validates the preview file against its selected root before querying GIO', async () => {
  await withFixture(async fixture => {
    let commandCount = 0;
    const execFileImpl = (...args) => { commandCount++; return fixture.execFileImpl(...args); };
    await assert.rejects(
      listExternalApplicationsInRoot(fixture.root, '/etc/hosts', {
        platform: 'linux', env: fixture.env, home: fixture.temporaryDirectory, execFileImpl
      }),
      /根目录|文件|路径/
    );
    assert.equal(commandCount, 0);
  });
});

test('non-Linux platforms keep the existing default and Other menu path without fake enumeration', async () => {
  await withFixture(async fixture => {
    const listed = await listExternalApplicationsInRoot(fixture.root, fixture.filePath, { platform: 'darwin' });
    assert.deepEqual(listed, []);
  });
});

test('launches a still-registered application through gio with a fixed argument vector', async () => {
  await withFixture(async fixture => {
    let launch;
    const spawnProcess = (executable, args, options) => {
      launch = { executable, args, options };
      const child = new EventEmitter();
      child.unref = () => { child.unreferenced = true; };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    };
    const result = await openFileWithRegisteredApplicationInRoot(
      fixture.root, fixture.filePath, 'org.example.alpha.desktop', {
        platform: 'linux', env: fixture.env, home: fixture.temporaryDirectory, locale: 'en-US',
        execFileImpl: fixture.execFileImpl, spawnProcess
      }
    );
    assert.equal(result, true);
    assert.equal(launch.executable, 'gio');
    assert.deepEqual(launch.args, ['launch', path.join(fixture.applicationsDirectory, 'org.example.alpha.desktop'), fixture.filePath]);
    assert.equal(launch.options.shell, false);
    assert.equal(launch.options.detached, true);
    assert.equal(launch.options.stdio, 'ignore');
  });
});

test('refuses an application that is no longer registered and never launches it', async () => {
  await withFixture(async fixture => {
    const execFileImpl = (executable, args, options, callback) => {
      const result = args[0] === 'info'
        ? 'standard::content-type: text/plain\n'
        : 'Default application for “text/plain”: org.example.zulu.desktop\nRegistered applications:\norg.example.zulu.desktop\n';
      queueMicrotask(() => callback(null, result, ''));
    };
    let launched = false;
    await assert.rejects(
      openFileWithRegisteredApplicationInRoot(fixture.root, fixture.filePath, 'org.example.alpha.desktop', {
        platform: 'linux', env: fixture.env, home: fixture.temporaryDirectory, execFileImpl,
        spawnProcess: () => { launched = true; throw new Error('unexpected launch'); }
      }),
      /已不可用|不再适用/
    );
    assert.equal(launched, false);
  });
});

test('falls back to the existing generic menu when GIO is unavailable', async () => {
  await withFixture(async fixture => {
    const listed = await listExternalApplicationsInRoot(fixture.root, fixture.filePath, {
      platform: 'linux', env: fixture.env, home: fixture.temporaryDirectory,
      execFileImpl: (_executable, _args, _options, callback) => queueMicrotask(() => callback(new Error('ENOENT'), '', ''))
    });
    assert.deepEqual(listed, []);
  });
});

test('wires registry lookup and launch through explicit main/preload IPC and accessible menu items', async () => {
  const [main, preload, renderer, html] = await Promise.all([
    readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../electron/preload.cjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(main, /directory:list-external-applications[\s\S]*?listExternalApplicationsInRoot\(selectedRoot, requestedPath/);
  assert.match(main, /directory:open-registered-application[\s\S]*?openFileWithRegisteredApplicationInRoot\(selectedRoot, payload\.path, payload\.applicationId/);
  assert.match(preload, /listExternalApplications: \(filePath\) => ipcRenderer\.invoke\('directory:list-external-applications'/);
  assert.match(preload, /openRegisteredApplication: \(filePath, applicationId\) => ipcRenderer\.invoke\('directory:open-registered-application'/);
  assert.match(renderer, /refreshFolderPreviewExternalApplications\(folderPreviewPath\)/);
  assert.match(renderer, /button\.dataset\.registeredApplicationId = application\.id/);
  assert.match(renderer, /openRegisteredApplication\(filePath, applicationId\)/);
  assert.match(html, /id="folder-preview-registered-applications"/);
  assert.match(html, /id="folder-preview-open-with"[^>]*role="menuitem"[^>]*>其他应用…/);
});
