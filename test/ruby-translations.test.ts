import { translateTypeScript } from '../lib/translate';
import { RubyVisitor } from '../lib/languages/ruby';

/**
 * Syntactic translation of a TypeScript snippet to Ruby (no type resolution needed for these
 * cases). Returns the rendered Ruby source.
 */
function toRuby(source: string): string {
  return translateTypeScript({ contents: source, fileName: 'test.ts' }, new RubyVisitor()).translation;
}

describe('imports -> require', () => {
  test.each([
    // A plain package import maps to the gem of the same name.
    ["import * as cdk from 'aws-cdk-lib';", "require 'aws-cdk-lib'"],
    // A *submodule* import resolves to the gem, not a per-submodule require: the
    // submodule is autoloaded from the package. Regression: this used to `/`->`-` the
    // whole path and emit `require 'aws-cdk-lib-aws-s3tables'`.
    ["import * as s3tables from 'aws-cdk-lib/aws-s3tables';", "require 'aws-cdk-lib'"],
    ["import { Bucket } from 'aws-cdk-lib/aws-s3';", "require 'aws-cdk-lib'"],
    // Scoped packages: @scope/name -> scope-name; a submodule still maps to the package.
    ["import { Foo } from '@scope/jsii-calc-lib';", "require 'scope-jsii-calc-lib'"],
    ["import { Foo } from '@scope/jsii-calc-lib/submodule';", "require 'scope-jsii-calc-lib'"],
  ])('%s -> %s', (source, expected) => {
    expect(toRuby(source)).toContain(expected);
  });

  test('relative imports use require_relative', () => {
    expect(toRuby("import { Foo } from './my-module';")).toContain("require_relative './my-module'");
  });
});

describe('array literal formatting', () => {
  test('a broken array puts each element on its own line, not just the closing bracket', () => {
    const ruby = toRuby(
      [
        "new Foo(stack, 'T', {",
        '  replicas: [',
        "    { region: 'us-east-1' }, { region: 'us-east-2' }",
        '  ],',
        '});',
      ].join('\n'),
    );
    // Regression: elements shared one line while `]` dropped to its own line
    // (`...{region: "us-east-2"}\n    ]`). Each element should be on its own line.
    expect(ruby).toMatch(/\{region: "us-east-1"\},\n/);
    expect(ruby).toContain('{region: "us-east-2"}');
  });

  test('a short array stays inline', () => {
    expect(toRuby('const x = [1, 2, 3];')).toContain('[1, 2, 3]');
  });

  test('a broken hash keeps a property after a multi-line value on its own line', () => {
    const ruby = toRuby(
      [
        "new Foo(stack, 'T', {",
        '  importSource: {',
        '    inputFormat: InputFormat.csv({',
        "      delimiter: ',',",
        '    }),',
        '    bucket: bucket,',
        '  },',
        '});',
      ].join('\n'),
    );
    // Regression: `bucket:` was stranded on the csv(...) closing line (`}), bucket: bucket`).
    expect(ruby).toMatch(/\}\),\n\s*bucket: bucket/);
  });

  test('a short hash stays inline', () => {
    expect(toRuby("const x = { a: 1, b: 2 };")).toContain('{a: 1, b: 2}');
  });
});

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

  test('static readonly (const) property access uses `.` + the constant name, not dropped', () => {
    // Regression: `BlockPublicAccess.BLOCK_ALL` used to render as just the type
    // (`...BlockPublicAccess`), silently dropping the member.
    const ruby = toRuby(['class C {', '  static readonly BLOCK_ALL = new C();', '}', 'const x = C.BLOCK_ALL;'].join('\n'));
    expect(ruby).toContain('C.BLOCK_ALL');
    // dot access, not the enum-style `::`
    expect(ruby).not.toContain('C::BLOCK_ALL');
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
