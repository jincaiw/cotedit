#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath, outputPath = 'lib/unicode-nfkc-casefold.js'] = process.argv.slice(2);
if (!inputPath) {
  console.error('Usage: node scripts/generate-nfkc-casefold.mjs DerivedNormalizationProps.txt [output.js]');
  process.exit(2);
}

const mappings = [];
for (const rawLine of readFileSync(inputPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.split('#', 1)[0].trim();
  if (!line) continue;
  const [rangeField, property, mappingField = ''] = line.split(';').map(field => field.trim());
  if (property !== 'NFKC_CF') continue;
  const [startField, endField = startField] = rangeField.split('..');
  const start = Number.parseInt(startField, 16);
  const end = Number.parseInt(endField, 16);
  const output = mappingField ? mappingField.split(/\s+/).map(value => Number.parseInt(value, 16)) : [];
  for (let codePoint = start; codePoint <= end; codePoint++) {
    if (output.length === 1 && output[0] === codePoint) continue;
    mappings.push(`${codePoint.toString(16).toUpperCase()}=${output.map(value => value.toString(16).toUpperCase()).join(' ')}`);
  }
}

const encoded = mappings.join(';');
const moduleSource = `// Generated from Unicode 17.0.0 DerivedNormalizationProps.txt (NFKC_CF).\n// Source: https://www.unicode.org/Public/17.0.0/ucd/DerivedNormalizationProps.txt\n// Unicode data license: https://www.unicode.org/license.txt\nexport const UNICODE_NFKC_CASEFOLD_VERSION = '17.0.0';\nconst encodedMappings = '${encoded}';\nexport const NFKC_CASEFOLD_MAPPINGS = new Map(encodedMappings.split(';').map(entry => {\n  const [source, mapping = ''] = entry.split('=');\n  const value = mapping ? mapping.split(' ').map(codePoint => String.fromCodePoint(Number.parseInt(codePoint, 16))).join('') : '';\n  return [Number.parseInt(source, 16), value];\n}));\n`;
writeFileSync(outputPath, moduleSource);
console.log(`Wrote ${mappings.length} Unicode 17 NFKC_CF mappings (${Buffer.byteLength(moduleSource)} bytes) to ${outputPath}`);
