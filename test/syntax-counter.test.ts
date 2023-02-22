import { SyntaxKind } from 'typescript';
import { TestJsiiModule, DUMMY_JSII_CONFIG } from './testutil';

let assembly: TestJsiiModule;
beforeAll(() => {
  assembly = TestJsiiModule.fromSource(
    `
    export class ClassA {
      public someMethod() {
      }
    }
    export class ClassB {
      public argumentMethod(args: BeeArgs) {
        Array.isArray(args);
      }
    }
    export interface BeeArgs { readonly value: string; readonly nested?: NestedType; }
    export interface NestedType { readonly x: number; }
    `,
    {
      name: 'my_assembly',
      jsii: DUMMY_JSII_CONFIG,
    },
  );
});
afterAll(() => assembly.cleanup());

test('generate syntax counter', () => {
  const translator = assembly.successfullyCompile(`
    import * as ass from 'my_assembly';
    const a = new ass.ClassA();
  `);
  expect(translator.syntaxKindCounter()).toEqual({
    [SyntaxKind.StringLiteral]: 1,
    [SyntaxKind.Identifier]: 4,
    [SyntaxKind.PropertyAccessExpression]: 1,
    [SyntaxKind.NewExpression]: 1,
    [SyntaxKind.VariableStatement]: 1,
    [SyntaxKind.VariableDeclaration]: 1,
    [SyntaxKind.VariableDeclarationList]: 1,
    [SyntaxKind.ImportDeclaration]: 1,
    [SyntaxKind.ImportClause]: 1,
    [SyntaxKind.NamespaceImport]: 1,
    [SyntaxKind.SourceFile]: 1,
  });
});

test('do not count syntax in hidden lines', () => {
  const translator = assembly.successfullyCompile(`
    /// !hide
    import * as ass from 'my_assembly';
    const a = new ass.ClassA();
    /// !show
    const b = new ass.ClassB();
  `);
  expect(translator.syntaxKindCounter()).toEqual({
    [SyntaxKind.Identifier]: 3,
    [SyntaxKind.PropertyAccessExpression]: 1,
    [SyntaxKind.NewExpression]: 1,
    [SyntaxKind.VariableStatement]: 1,
    [SyntaxKind.VariableDeclaration]: 1,
    [SyntaxKind.VariableDeclarationList]: 1,
  });
});
