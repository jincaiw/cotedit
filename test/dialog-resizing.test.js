import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

const dialogs = [
  ['snippet-manager-dialog', 'snippet-manager-dialog'],
  ['text-replacement-manager-dialog', 'text-replacement-manager-dialog'],
  ['file-drop-settings-dialog', 'file-drop-settings-dialog'],
  ['multiple-replace-dialog', 'multiple-replace-dialog']
];

function declarationBlock(selectorPattern) {
  const match = styles.match(selectorPattern);
  assert.ok(match, `missing CSS rule ${selectorPattern}`);
  return match[1];
}

test('large settings, rule-manager, and multi-replacement dialogs opt into the shared resizable layout', () => {
  for (const [id, className] of dialogs) {
    assert.match(html, new RegExp(`<dialog id="${id}" class="${className} resizable-settings-dialog"`));
  }
});

test('resizable settings dialogs keep bounded minimum and maximum dimensions', () => {
  const declarations = declarationBlock(/\.resizable-settings-dialog\s*\{([^}]*)\}/);
  assert.match(declarations, /resize:\s*both\s*;/);
  assert.match(declarations, /overflow:\s*hidden\s*;/);
  assert.match(declarations, /box-sizing:\s*border-box\s*;/);
  assert.match(declarations, /min-width:\s*min\(620px,\s*calc\(100vw\s*-\s*20px\)\)\s*;/);
  assert.match(declarations, /min-height:\s*min\(520px,\s*calc\(100vh\s*-\s*20px\)\)\s*;/);
  assert.match(declarations, /max-width:\s*calc\(100vw\s*-\s*20px\)\s*;/);
  assert.match(declarations, /max-height:\s*calc\(100vh\s*-\s*20px\)\s*;/);
});

test('open resizable dialogs give remaining height to their scrollable editor shells', () => {
  const openDeclarations = declarationBlock(/\.resizable-settings-dialog\[open\]\s*\{([^}]*)\}/);
  assert.match(openDeclarations, /display:\s*flex\s*;/);
  assert.match(openDeclarations, /flex-direction:\s*column\s*;/);
  assert.match(openDeclarations, /height:\s*min\(86vh,\s*780px\)\s*;/);

  const shellDeclarations = declarationBlock(/\.resizable-settings-dialog\[open\]\s*>\s*\.snippet-manager-shell,\s*\.resizable-settings-dialog\[open\]\s*>\s*\.file-drop-settings-shell,\s*\.resizable-settings-dialog\[open\]\s*>\s*\.multiple-replace-shell\s*\{([^}]*)\}/);
  assert.match(shellDeclarations, /flex:\s*1\s+1\s+auto\s*;/);
  assert.match(shellDeclarations, /min-height:\s*0\s*;/);
  assert.match(shellDeclarations, /max-height:\s*none\s*;/);
  assert.match(shellDeclarations, /overflow:\s*hidden\s*;/);
});
