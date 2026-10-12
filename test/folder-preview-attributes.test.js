import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFolderPreviewAttributes } from '../lib/folder-preview-attributes.js';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

const values = result => Object.fromEntries(buildFolderPreviewAttributes(result).map(({ label, value }) => [label, value]));

test('plain-text preview keeps size, encoding and truncation in separate attributes', () => {
  assert.deepEqual(buildFolderPreviewAttributes({ size: 1536, encoding: 'UTF-8', truncated: true }), [
    { label: '大小', value: '1.5 KB' },
    { label: '类型', value: '文本' },
    { label: '编码', value: 'UTF-8' },
    { label: '预览', value: '已截断' }
  ]);
  assert.deepEqual(buildFolderPreviewAttributes({ size: 0, encoding: 'UTF-8', truncated: false }), [
    { label: '大小', value: '0 B' },
    { label: '类型', value: '文本' },
    { label: '编码', value: 'UTF-8' }
  ]);
});

test('generic text kind is emitted only for a confirmed decoder encoding scalar', () => {
  assert.deepEqual(buildFolderPreviewAttributes({ size: 1, encoding: 'utf-8' }), [
    { label: '大小', value: '1 B' },
    { label: '类型', value: '文本' },
    { label: '编码', value: 'utf-8' }
  ]);
  assert.deepEqual(buildFolderPreviewAttributes({ size: 1, encoding: null }), [
    { label: '大小', value: '1 B' }
  ]);
});

test('image preview exposes only validated dimensions, horizontal DPI and known model/profile rows', () => {
  assert.deepEqual(buildFolderPreviewAttributes({
    size: 3,
    image: true,
    imageDimensions: { width: 640, height: 480 },
    imageDpi: 72.25,
    imageColorModel: 'RGB',
    imageColorProfile: 'Display P3'
  }), [
    { label: '大小', value: '3 B' },
    { label: '类型', value: '图像' },
    { label: '尺寸', value: '640\u200a×\u200a480 像素' },
    { label: '水平 DPI', value: '72.3 像素/英寸' },
    { label: '色彩模型', value: 'RGB' },
    { label: '色彩配置文件', value: 'Display P3' }
  ]);
});

test('image metadata rejects unsupported labels and omits invalid optional scalars', () => {
  assert.deepEqual(values({
    size: Number.MAX_SAFE_INTEGER + 1,
    image: true,
    imageDimensions: { width: 0, height: 8 },
    imageDpi: Infinity,
    imageColorModel: 'CMYK',
    imageColorProfile: '/tmp/profile.icc',
    encoding: 'UTF-8'
  }), { 大小: '未知', 编码: 'UTF-8' });
});

test('audio and movie previews preserve compact CotEditor-style duration formatting', () => {
  assert.deepEqual(values({ size: 8000, audio: true, audioKind: 'WAVE', audioDurationSeconds: 59.7 }), {
    大小: '7.8 KB', 类型: 'WAVE 音频', 时长: '1:00'
  });
  assert.equal(values({ audio: true, audioKind: 'AIFF-C', audioDurationSeconds: 3599.6 }).时长, '1:00:00');
  assert.equal(values({ audio: true, audioKind: 'bogus', audioDurationSeconds: -1 }).时长, '未知');
  assert.deepEqual(values({
    isoBmff: true,
    movie: true,
    movieDimensions: { width: 1920, height: 1080 },
    movieDurationSeconds: 62
  }), { 大小: '未知', 类型: 'ISO BMFF 视频', 尺寸: '1920\u200a×\u200a1080 像素', 时长: '1:02' });
  assert.equal(values({ isoBmff: true, movie: false }).预览, '受限范围内未确认视频轨道');
});

test('executable and binary property-list states remain explicit and text-safe', () => {
  assert.deepEqual(values({ size: 17, executable: true, encoding: 'UTF-8' }), {
    大小: '17 B', 类型: 'UNIX 可执行文件', 预览: '不作纯文本预览'
  });
  assert.deepEqual(values({ size: 24, binaryPropertyList: true }), {
    大小: '24 B', 类型: '二进制 Property List', 预览: '不作纯文本预览'
  });
});

test('renderer builds semantic definition-list rows with textContent, never interpolated HTML', () => {
  assert.match(index, /<dl id="folder-preview-attributes" class="folder-preview-attributes" aria-label="文件属性"><\/dl>/);
  assert.match(renderer, /import \{ buildFolderPreviewAttributes \} from '\.\.\/lib\/folder-preview-attributes\.js'/);
  assert.match(renderer, /function renderFolderPreviewAttributes\(attributes\)[\s\S]*?term\.textContent = attribute\.label[\s\S]*?value\.textContent = attribute\.value[\s\S]*?list\.replaceChildren\(fragment\)/);
  assert.match(renderer, /renderFolderPreviewAttributes\(buildFolderPreviewAttributes\(result\)\)/);
  const renderFunction = renderer.match(/function renderFolderPreviewAttributes\(attributes\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(renderFunction);
  assert.doesNotMatch(renderFunction, /innerHTML/);
  assert.match(style, /\.folder-preview-attributes:empty \{ display: none; \}/);
  assert.match(style, /\.folder-preview-attribute \{[^}]*grid-template-columns/);
});
