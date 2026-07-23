import { JavaVisitor } from '../../lib/languages/java';
import { PythonVisitor } from '../../lib/languages/python';
import { RubyVisitor } from '../../lib/languages/ruby';
import { translateTypeScript } from '../../lib/translate';

// The DefaultVisitor cannot translate ternaries or postfix `++`/`--`, so those
// handlers must degrade exactly like nodes without a typed dispatch case: report
// an "unsupported" diagnostic, then pass the original TypeScript text through
// unchanged (in best-effort mode, the default) or render an UnknownSyntax
// placeholder (when best-effort is disabled). Ruby overrides both handlers with
// real translations, which must be unaffected.

const TERNARY = 'const x = a === b ? null : myValue;';
const POSTFIX = 'let i = 0;\ni++;';
const ARROW = 'foo({ produce: () => arnLookup });';

describe.each([
  ['Python', () => new PythonVisitor()],
  ['Java', () => new JavaVisitor()],
] as const)('%s falls back to raw source text', (_language, makeVisitor) => {
  test('for a ternary', () => {
    const result = translateTypeScript({ contents: TERNARY, fileName: 'test.ts' }, makeVisitor());

    expect(result.translation).toContain('a === b ? null : myValue');
    expect(result.translation).not.toContain('ConditionalExpression');
    expect(result.diagnostics.some((d) => d.formattedMessage.includes('not supported'))).toBe(true);
  });

  test('for a postfix increment', () => {
    const result = translateTypeScript({ contents: POSTFIX, fileName: 'test.ts' }, makeVisitor());

    expect(result.translation).toContain('i++');
    expect(result.translation).not.toContain('PostfixUnaryExpression');
    expect(result.diagnostics.some((d) => d.formattedMessage.includes('not supported'))).toBe(true);
  });

  test('for an arrow function', () => {
    const result = translateTypeScript({ contents: ARROW, fileName: 'test.ts' }, makeVisitor());

    expect(result.translation).toContain('() => arnLookup');
    expect(result.translation).not.toContain('ArrowFunction');
    expect(result.diagnostics.some((d) => d.formattedMessage.includes('not supported'))).toBe(true);
  });
});

test('a ternary renders a placeholder when best-effort is disabled', () => {
  const result = translateTypeScript({ contents: TERNARY, fileName: 'test.ts' }, new PythonVisitor(), {
    bestEffort: false,
  });

  expect(result.translation).toContain('<ConditionalExpression a === b ? null : myValue>');
});

describe('Ruby overrides the fallback', () => {
  test('translates a ternary', () => {
    const result = translateTypeScript({ contents: TERNARY, fileName: 'test.ts' }, new RubyVisitor());

    expect(result.translation).toContain('a == b ? nil : my_value');
    expect(result.diagnostics).toHaveLength(0);
  });

  test('translates a postfix increment', () => {
    const result = translateTypeScript({ contents: POSTFIX, fileName: 'test.ts' }, new RubyVisitor());

    expect(result.translation).toContain('i += 1');
    expect(result.diagnostics).toHaveLength(0);
  });

  test('translates arrow functions to lambdas', () => {
    // Plain arrow: no diagnostics at all.
    const plain = translateTypeScript({ contents: 'const cb = () => arnLookup;', fileName: 'test.ts' }, new RubyVisitor());
    expect(plain.translation).toContain('cb = -> { arn_lookup }');
    expect(plain.diagnostics).toHaveLength(0);

    // The TypeScript-object-literal callback mirror. (The untyped object
    // literal itself carries rosetta's standard "cannot infer type" warning —
    // unrelated to arrows — so only the rendering is asserted here.)
    const literal = translateTypeScript({ contents: ARROW, fileName: 'test.ts' }, new RubyVisitor());
    expect(literal.translation).toContain('produce: -> { arn_lookup }');
    expect(literal.translation).not.toContain('=>');
  });

  test('translates a parameterised block-bodied arrow', () => {
    const source = 'consumer.ring((bell) => {\n  bell.ring();\n  return true;\n});';
    const result = translateTypeScript({ contents: source, fileName: 'test.ts' }, new RubyVisitor());

    expect(result.translation).toContain('->(bell) {');
    expect(result.translation).toContain('bell.ring');
    expect(result.diagnostics).toHaveLength(0);
  });

  test('a destructuring arrow parameter falls back to raw source with a diagnostic', () => {
    const source = 'foo(({ a }) => a);';
    const result = translateTypeScript({ contents: source, fileName: 'test.ts' }, new RubyVisitor());

    expect(result.translation).toContain('({ a }) => a');
    expect(result.diagnostics.some((d) => d.formattedMessage.includes('not supported'))).toBe(true);
  });
});
