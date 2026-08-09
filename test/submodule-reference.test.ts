import * as ts from 'typescript';

import { SubmoduleReference } from '../lib/submodule-reference';

// `ts.Symbol.declarations` is optional in the TypeScript API — the checker
// produces symbols without declarations (its error symbol, among others).
// submodule-reference asserted it non-null, so one such symbol anywhere in a
// snippet took down the whole jsii-pacmak run with
// `Cannot read properties of undefined (reading 'length')` instead of
// skipping that snippet. Reachable in practice: jsii-pacmak translates
// library `@example` blocks with compiler diagnostics off, so snippets that
// do not fully resolve are routine.
describe('SubmoduleReference with declaration-less symbols', () => {
  const SOURCE = [
    "import * as masm from 'my_assembly';",
    'const x = masm.submod.Thing;',
    '',
  ].join('\n');

  /**
   * A checker that resolves the import name to a stable symbol (so the
   * property-access head counts as an imported namespace) and every other
   * identifier to a symbol with no declarations at all.
   */
  function stubChecker(sourceFile: ts.SourceFile): ts.TypeChecker {
    const importSymbol = { name: 'masm', flags: 0, declarations: [sourceFile.statements[0]] } as any;
    const declarationLess = { name: 'submod', flags: 0, declarations: undefined } as any;

    return {
      getSymbolAtLocation(node: ts.Node) {
        if (ts.isIdentifier(node) && node.text === 'masm') return importSymbol;
        return declarationLess;
      },
    } as any;
  }

  test('does not throw when a symbol has no declarations', () => {
    const sourceFile = ts.createSourceFile('snippet.ts', SOURCE, ts.ScriptTarget.Latest, true);
    expect(() => SubmoduleReference.inSourceFile(sourceFile, stubChecker(sourceFile))).not.toThrow();
  });

  test('treats a declaration-less symbol as not-a-namespace', () => {
    // The heuristic answers "is this identifier a namespace?". Nothing is
    // known about a symbol with no declarations, so the honest answer is no —
    // which makes it the start of the type path rather than part of the
    // module path.
    const sourceFile = ts.createSourceFile('snippet.ts', SOURCE, ts.ScriptTarget.Latest, true);
    const map = SubmoduleReference.inSourceFile(sourceFile, stubChecker(sourceFile));
    for (const ref of map.values()) {
      expect(ref.path).toHaveLength(0);
    }
  });
});
