import { translateTypeScript } from '../lib/translate';
import { RubyVisitor } from '../lib/languages/ruby';

/**
 * Syntactic translation of a TypeScript snippet to Ruby (no type resolution needed for these
 * cases). Returns the rendered Ruby source.
 */
function toRuby(source: string): string {
  return translateTypeScript({ contents: source, fileName: 'test.ts' }, new RubyVisitor()).translation;
}

describe('if / elsif / else chains', () => {
  test('an if / else-if / else chain emits exactly one `end`', () => {
    const ruby = toRuby(['if (a) {', '  x();', '} else if (b) {', '  y();', '} else {', '  z();', '}'].join('\n'));

    expect(ruby).toContain('elsif');
    expect(ruby).toContain('else');
    // Exactly one closing `end` for the whole chain (regression: used to emit two).
    expect(ruby.match(/^end$/gm) ?? []).toHaveLength(1);
  });

  test('nested else-if renders `elsif`, not a nested `if`', () => {
    const ruby = toRuby(['if (a) {', '  x();', '} else if (b) {', '  y();', '}'].join('\n'));
    expect(ruby).toContain('elsif');
    expect(ruby.match(/^end$/gm) ?? []).toHaveLength(1);
  });
});

describe('string escaping', () => {
  test('literal `#{` in a string is escaped so Ruby does not interpolate it', () => {
    const ruby = toRuby('const s = "a#{b}c";');
    expect(ruby).toContain('"a\\#{b}c"');
  });

  test('template literals escape embedded quotes but keep real interpolation', () => {
    const ruby = toRuby('const x = 1;\nconst s = `say "hi" ${x}`;');
    expect(ruby).toContain('\\"hi\\"'); // embedded quotes escaped
    expect(ruby).toContain('#{x}'); // interpolation preserved
  });
});

describe('static members', () => {
  test('a static method becomes `def self.<name>`', () => {
    const ruby = toRuby('class C {\n  static foo() {\n    return 1;\n  }\n}');
    expect(ruby).toContain('def self.foo');
    expect(ruby).not.toContain('def foo');
  });

  test('a static readonly field becomes a Ruby constant preserving its value', () => {
    const ruby = toRuby('class C {\n  static readonly FOO = 5;\n}');
    expect(ruby).toContain('FOO = 5');
    expect(ruby).not.toContain('attr_reader :foo');
  });
});

describe('type assertions', () => {
  test('`as number` / `as string` pass through without runtime coercion', () => {
    const ruby = toRuby('const a = 1;\nconst n = a as number;\nconst s = a as string;');
    expect(ruby).not.toContain('.to_i');
    expect(ruby).not.toContain('.to_s');
  });
});

describe('super calls', () => {
  test('`super()` renders with explicit empty parens (not bare `super`)', () => {
    const ruby = toRuby('class C extends B {\n  constructor() {\n    super();\n  }\n}');
    expect(ruby).toContain('super()');
  });
});
