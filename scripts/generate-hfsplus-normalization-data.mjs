#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [unicodeDataPath, derivedNormalizationPropsPath, outputPath = 'lib/unicode-hfsplus-normalization-data.js'] = process.argv.slice(2);
if (!unicodeDataPath || !derivedNormalizationPropsPath) {
  console.error('Usage: node scripts/generate-hfsplus-normalization-data.mjs UnicodeData-3.2.0.txt DerivedNormalizationProps-17.0.0.txt [output.js]');
  process.exit(2);
}

function hex(value) {
  return value.toString(16).toUpperCase();
}

const decompositions = [];
const combiningClasses = [];
for (const rawLine of readFileSync(unicodeDataPath, 'utf8').split(/\r?\n/)) {
  if (!rawLine) continue;
  const fields = rawLine.split(';');
  const codePoint = Number.parseInt(fields[0], 16);
  const combiningClass = Number.parseInt(fields[3], 10);
  const decomposition = fields[5].trim();
  if (combiningClass) combiningClasses.push(`${hex(codePoint)}=${combiningClass}`);
  if (decomposition && !decomposition.startsWith('<')) {
    decompositions.push(`${hex(codePoint)}=${decomposition.split(/\s+/).map(value => hex(Number.parseInt(value, 16))).join(' ')}`);
  }
}

const exclusionRanges = [];
for (const rawLine of readFileSync(derivedNormalizationPropsPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.split('#', 1)[0].trim();
  if (!line) continue;
  const [rangeField, property] = line.split(';').map(field => field.trim());
  if (property !== 'Full_Composition_Exclusion') continue;
  const [startField, endField = startField] = rangeField.split('..');
  exclusionRanges.push([Number.parseInt(startField, 16), Number.parseInt(endField, 16)]);
}

if (!decompositions.length || !combiningClasses.length || !exclusionRanges.length) {
  throw new Error('One or more required Unicode datasets were not parsed.');
}

const mergedRanges = [];
for (const [start, end] of exclusionRanges.sort((left, right) => left[0] - right[0])) {
  const previous = mergedRanges.at(-1);
  if (previous && start <= previous[1] + 1) previous[1] = Math.max(previous[1], end);
  else mergedRanges.push([start, end]);
}

const moduleSource = `// Generated from UnicodeData-3.2.0.txt and Unicode 17.0.0 DerivedNormalizationProps.txt.\n// Sources: https://www.unicode.org/Public/3.2-Update/UnicodeData-3.2.0.txt\n//          https://www.unicode.org/Public/17.0.0/ucd/DerivedNormalizationProps.txt\n// Unicode data license: https://www.unicode.org/license.txt\nconst encodedCanonicalDecompositions = '${decompositions.join(';')}';\nexport const HFSPLUS_CANONICAL_DECOMPOSITIONS = new Map(encodedCanonicalDecompositions.split(';').map(entry => {\n  const [source, mapping] = entry.split('=');\n  return [Number.parseInt(source, 16), mapping.split(' ').map(value => Number.parseInt(value, 16))];\n}));\nconst encodedCombiningClasses = '${combiningClasses.join(';')}';\nexport const HFSPLUS_COMBINING_CLASSES = new Map(encodedCombiningClasses.split(';').map(entry => {\n  const [source, value] = entry.split('=');\n  return [Number.parseInt(source, 16), Number.parseInt(value, 10)];\n}));\nexport const UNICODE_17_FULL_COMPOSITION_EXCLUSION_RANGES = Object.freeze([\n${mergedRanges.map(([start, end]) => `  Object.freeze([0x${hex(start)}, 0x${hex(end)}])`).join(',\n')}\n]);\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, moduleSource);
console.log(`Wrote ${decompositions.length} canonical mappings, ${combiningClasses.length} combining classes, and ${mergedRanges.length} Unicode 17 Full_Composition_Exclusion ranges (${Buffer.byteLength(moduleSource)} bytes) to ${outputPath}`);
