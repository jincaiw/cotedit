import test from 'node:test';
import assert from 'node:assert/strict';
import { getSingleGraphemeSelection, getSingleGraphemeSelectionInText, startsInsideExtendedPictographicZwjSequence, startsInsideIndicConjunctSequence, startsInsideRegionalIndicatorRun } from '../lib/character-selection.js';
import { hasIndicConjunctBreak } from '../lib/unicode-incb.js';

test('accepts a selected supplementary-plane grapheme at valid boundaries', () => {
  assert.deepEqual(getSingleGraphemeSelection('a😀b', 1, 3), { from: 1, to: 3, text: '😀' });
});

test('accepts a complete combining-mark grapheme and rejects partial boundaries', () => {
  const text = 'xe\u0301y';
  assert.deepEqual(getSingleGraphemeSelection(text, 1, 3), { from: 1, to: 3, text: 'e\u0301' });
  assert.equal(getSingleGraphemeSelection(text, 1, 2), null);
  assert.equal(getSingleGraphemeSelection(text, 2, 3), null);
});

test('accepts a complete emoji ZWJ sequence and rejects only part of it', () => {
  const text = 'x👨‍👩‍👧‍👦y';
  const start = 1;
  const end = text.length - 1;
  assert.deepEqual(getSingleGraphemeSelection(text, start, end), { from: start, to: end, text: '👨‍👩‍👧‍👦' });
  assert.equal(getSingleGraphemeSelection(text, start, start + 2), null);
});

test('rejects empty, multiple-character and multiple-range selections', () => {
  assert.equal(getSingleGraphemeSelection('abc', 1, 1), null);
  assert.equal(getSingleGraphemeSelection('abc', 0, 2), null);
  assert.equal(getSingleGraphemeSelection('abc', 0, 1, 2), null);
  assert.equal(getSingleGraphemeSelection('abc', -1, 1), null);
});

test('preserves regional-indicator pairing when the bounded context starts mid-run', () => {
  const regionalIndicator = String.fromCodePoint(0x1f1e6);
  const text = `X${regionalIndicator.repeat(10)}Y`;
  const misalignedSingleIndicatorFrom = 1 + 2 * 9;
  assert.equal(getSingleGraphemeSelectionInText(text, misalignedSingleIndicatorFrom, misalignedSingleIndicatorFrom + 2), null,
    'a local slice must not turn the tenth indicator into a standalone grapheme');

  const completeFlagFrom = 1 + 2 * 4;
  assert.deepEqual(getSingleGraphemeSelectionInText(text, completeFlagFrom, completeFlagFrom + 4), {
    from: completeFlagFrom, to: completeFlagFrom + 4, text: regionalIndicator.repeat(2)
  }, 'a complete regional-indicator pair remains inspectable');
});

test('selects the regional-indicator correction path only when the context cuts an existing run', () => {
  const regionalIndicator = String.fromCodePoint(0x1f1e6);
  assert.equal(startsInsideRegionalIndicatorRun(regionalIndicator, `${regionalIndicator}x`), true);
  assert.equal(startsInsideRegionalIndicatorRun('x', `${regionalIndicator}x`), false,
    'a context beginning at a real run boundary does not need correction');
  assert.equal(startsInsideRegionalIndicatorRun('', `${regionalIndicator}x`), false,
    'text beginning with a regional indicator already has the correct initial parity');
});

test('does not mistake an emoji after a long GB11 Extend* ZWJ prefix for a standalone grapheme', () => {
  const emoji = '👩';
  const text = `X${emoji}${'\u0301'.repeat(20)}\u200d${emoji}Y`;
  const targetFrom = 1 + emoji.length + 20 + 1;
  const contextFrom = targetFrom - 16;

  assert.equal(startsInsideExtendedPictographicZwjSequence(text, contextFrom), true,
    'the 16-unit local window starts inside the unbounded Extend* part of GB11');
  assert.equal(getSingleGraphemeSelectionInText(text, targetFrom, targetFrom + emoji.length), null,
    'the final pictograph remains joined to the preceding ZWJ sequence');

  const completeTo = targetFrom + emoji.length;
  assert.deepEqual(getSingleGraphemeSelectionInText(text, 1, completeTo), {
    from: 1, to: completeTo, text: text.slice(1, completeTo)
  }, 'the complete extended grapheme remains selectable');
});

test('uses the GB11 full-context fallback only when a cut prefix forms an actual emoji ZWJ sequence', () => {
  const emoji = '👩';
  const prefix = `${emoji}${'\u0301'.repeat(4)}\u200d${emoji}`;
  assert.equal(startsInsideExtendedPictographicZwjSequence(prefix, emoji.length), true,
    'a context beginning after the initial pictograph cuts the GB11 prefix');
  assert.equal(startsInsideExtendedPictographicZwjSequence(prefix, 0), false,
    'a context beginning at the document start keeps the full prefix');
  assert.equal(startsInsideExtendedPictographicZwjSequence(`${emoji}${'\u0301'.repeat(4)}x`, emoji.length), false,
    'an Extend run not followed by ZWJ and another pictograph is not a GB11 sequence');
  assert.equal(startsInsideExtendedPictographicZwjSequence(`x${prefix}`, 1), false,
    'a context starting at a real grapheme boundary does not need the fallback');
});

test('uses Unicode 17 Indic_Conjunct_Break ranges for consonant, linker and extend properties', () => {
  assert.equal(hasIndicConjunctBreak(0x0915, 'Consonant'), true);
  assert.equal(hasIndicConjunctBreak(0x094D, 'Linker'), true);
  assert.equal(hasIndicConjunctBreak(0x0301, 'Extend'), true);
  assert.equal(hasIndicConjunctBreak(0x200D, 'Extend'), true);
  assert.equal(hasIndicConjunctBreak(0x200C, 'Extend'), false);
  assert.equal(hasIndicConjunctBreak(0x0914, 'Consonant'), false);
  assert.equal(hasIndicConjunctBreak(0x0915, 'Unsupported'), false);
});

test('does not mistake a trailing Indic consonant after a long GB9c prefix for a standalone grapheme', () => {
  const base = 'क';
  const linker = '्';
  const target = 'ष';
  const text = `X${base}${linker}${'\u0301'.repeat(20)}${target}Y`;
  const targetFrom = 1 + base.length + linker.length + 20;
  const contextFrom = targetFrom - 16;

  assert.equal(startsInsideIndicConjunctSequence(text, contextFrom, targetFrom), true,
    'the local context cuts a valid consonant-linker-extend-consonant prefix');
  assert.equal(getSingleGraphemeSelectionInText(text, targetFrom, targetFrom + target.length), null,
    'the final consonant remains joined to its preceding Indic conjunct');

  const completeTo = targetFrom + target.length;
  assert.deepEqual(getSingleGraphemeSelectionInText(text, 1, completeTo), {
    from: 1, to: completeTo, text: text.slice(1, completeTo)
  }, 'the complete Indic conjunct remains inspectable');
});

test('uses the GB9c fallback only when a valid Indic conjunct prefix is cut', () => {
  const base = 'क';
  const linker = '्';
  const target = 'ष';
  const marks = '\u0301'.repeat(20);
  const conjunct = `${base}${linker}${marks}${target}`;
  assert.equal(startsInsideIndicConjunctSequence(conjunct, 1, conjunct.length - target.length), true);
  assert.equal(startsInsideIndicConjunctSequence(conjunct, 0, conjunct.length - target.length), false,
    'a context beginning at the base consonant already retains the full prefix');

  const noLinker = `${base}${marks}${target}`;
  assert.equal(startsInsideIndicConjunctSequence(noLinker, 1, noLinker.length - target.length), false,
    'a long combining sequence without an InCB Linker is not a GB9c prefix');
  assert.ok(getSingleGraphemeSelectionInText(noLinker, noLinker.length - target.length, noLinker.length),
    'the final consonant without a linker remains selectable as its own grapheme');

  const nonConsonantTarget = `${base}${linker}${marks}A`;
  assert.equal(startsInsideIndicConjunctSequence(nonConsonantTarget, 1, nonConsonantTarget.length - 1), false,
    'an ordinary Latin letter is not treated as an InCB Consonant');
});
