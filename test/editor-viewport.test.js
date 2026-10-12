import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { scrollVerticalSelectionIntoView, setEditorStatePreservingScroll, verticalColumnDecoration, verticalLineNumberDecoration } from '../lib/editor-viewport.js';

function verticalScrollView({ rects, scrollLeft = 0, scrollTop = 0, scrollWidth = 600, visibleRanges } = {}) {
  const scrollDOM = {
    scrollLeft,
    scrollTop,
    scrollWidth,
    clientWidth: 400,
    clientHeight: 300,
    offsetWidth: 400,
    offsetHeight: 300,
    clientLeft: 0,
    clientTop: 0,
    getBoundingClientRect: () => ({ left: 100, right: 500, top: 50, bottom: 350, width: 400, height: 300 })
  };
  return {
    state: { doc: { length: 200 } },
    scrollDOM,
    visibleRanges,
    coordsAtPos(position) { return rects[position] ?? null; }
  };
}

test('vertical line-number decoration uses the document line, not the rendered-line counter', () => {
  const doc = EditorState.create({ doc: 'first\nsecond\nthird' }).doc;
  const line = doc.line(3);
  const decoration = verticalLineNumberDecoration(line);
  assert.equal(decoration.from, line.from);
  assert.deepEqual(decoration.value.spec.attributes, { 'data-line-number': '3' });
});

test('mirrored editor state preserves horizontal and vertical scroll offsets', () => {
  const nextState = { id: 'next' };
  const view = {
    state: { id: 'old' },
    scrollDOM: { scrollLeft: -245, scrollTop: 82 },
    setState(state) {
      this.state = state;
      this.scrollDOM.scrollLeft = 0;
      this.scrollDOM.scrollTop = 0;
    }
  };
  setEditorStatePreservingScroll(view, nextState);
  assert.equal(view.state, nextState);
  assert.equal(view.scrollDOM.scrollLeft, -245);
  assert.equal(view.scrollDOM.scrollTop, 82);
});

test('vertical scroll handler defers geometry reads until after the editor update', () => {
  const view = verticalScrollView({ rects: { 12: { left: 470, right: 480, top: 310, bottom: 320 } } });
  const originalState = view.state;
  let insideUpdate = true;
  let frame;
  const originalCoordsAtPos = view.coordsAtPos;
  view.coordsAtPos = (...args) => {
    assert.equal(insideUpdate, false, 'coordsAtPos must run after CodeMirror leaves its update cycle');
    return originalCoordsAtPos(...args);
  };
  assert.equal(scrollVerticalSelectionIntoView(view, { anchor: 12, head: 12 }, {
    x: 'center', y: 'center', xMargin: 5, yMargin: 5
  }, callback => { frame = callback; }), true);
  assert.equal(view.scrollDOM.scrollLeft, 0);
  assert.equal(typeof frame, 'function');
  insideUpdate = false;
  frame();
  assert.equal(view.state, originalState);
  assert.equal(view.scrollDOM.scrollLeft, 175);
  assert.equal(view.scrollDOM.scrollTop, 115);
});

test('vertical scroll handler minimally reveals an off-screen rendered range', () => {
  const view = verticalScrollView({ rects: { 12: { left: 495, right: 505, top: 120, bottom: 140 } } });
  assert.equal(scrollVerticalSelectionIntoView(view, { anchor: 12, head: 12 }, {
    x: 'nearest', y: 'nearest', xMargin: 5, yMargin: 5
  }), true);
  assert.equal(view.scrollDOM.scrollLeft, 10);
  assert.equal(view.scrollDOM.scrollTop, 0);
});

test('vertical writing keeps the CodeMirror virtual y offset for column virtualization', () => {
  const view = verticalScrollView({ rects: { 120: { left: 250, right: 260, top: 120, bottom: 140 } }, scrollTop: 6631082 });
  assert.equal(scrollVerticalSelectionIntoView(view, { anchor: 120, head: 120 }, {
    x: 'nearest', y: 'nearest', xMargin: 5, yMargin: 5, verticalWritingMode: true
  }, callback => callback()), true);
  assert.equal(view.scrollDOM.scrollTop, 6631082);
  assert.equal(view.scrollDOM.scrollLeft, 0);
});

test('vertical column decoration anchors rendered lines to stable document columns', () => {
  const doc = EditorState.create({ doc: 'first\nsecond\nthird' }).doc;
  const line = doc.line(3);
  const decoration = verticalColumnDecoration(line, 28);
  assert.equal(decoration.from, line.from);
  assert.deepEqual(decoration.value.spec.attributes, {
    'data-line-number': '3',
    style: 'position:absolute;top:0px;right:56px;height:auto;'
  });
  assert.equal(verticalColumnDecoration(line, 0), null);
});

test('vertical scroll handler ignores placeholder coordinates outside rendered ranges', () => {
  const view = verticalScrollView({
    rects: { 100: { left: 495, right: 505, top: 120, bottom: 140 } },
    visibleRanges: [{ from: 0, to: 40 }]
  });
  let frame;
  assert.equal(scrollVerticalSelectionIntoView(view, { anchor: 100, head: 100 }, {
    x: 'center', y: 'center', xMargin: 5, yMargin: 5
  }, callback => { frame = callback; }), true);
  assert.equal(typeof frame, 'function');
  frame();
  assert.equal(view.scrollDOM.scrollLeft, 0);
  assert.equal(view.scrollDOM.scrollTop, 0);
});

test('vertical scroll handler skips horizontal deltas when the editor has no horizontal overflow', () => {
  const view = verticalScrollView({
    rects: { 12: { left: 495, right: 505, top: 120, bottom: 140 } },
    scrollWidth: 400
  });
  scrollVerticalSelectionIntoView(view, { anchor: 12, head: 12 }, {
    x: 'nearest', y: 'nearest', xMargin: 5, yMargin: 5
  }, callback => callback());
  assert.equal(view.scrollDOM.scrollLeft, 0);
});

test('vertical scroll handler leaves an already-visible range in place', () => {
  const view = verticalScrollView({ rects: { 8: { left: 250, right: 260, top: 120, bottom: 140 } }, scrollLeft: -40, scrollTop: 12 });
  assert.equal(scrollVerticalSelectionIntoView(view, { anchor: 8, head: 8 }, {
    x: 'nearest', y: 'nearest', xMargin: 5, yMargin: 5
  }), true);
  assert.equal(view.scrollDOM.scrollLeft, -40);
  assert.equal(view.scrollDOM.scrollTop, 12);
});
