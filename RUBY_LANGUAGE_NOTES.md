# Ruby language notes

This document describes how jsii-rosetta renders TypeScript example snippets into
Ruby, and how that rendering differs from the other target languages
(Python, Java, C#, Go). It is intended for maintainers reviewing or extending the
Ruby visitor (`src/languages/ruby.ts`).

## Scope: what this is (and isn't)

jsii-rosetta translates the **example code** embedded in API documentation from
TypeScript into each target language. The Ruby support added here is exactly that:
a source-to-source renderer for doc snippets.

It is **not** a full jsii Ruby target. jsii itself has no official Ruby code
generator (jsii-pacmak) or runtime, so:

- Published `.jsii` assemblies do **not** carry a `targets.ruby` block. The
  resolver (`findRubyName`) reads `targets.ruby.module` / `targets.ruby.acronyms`
  when present, but in practice always falls back to heuristic name generation
  (`rubyModuleName`). Generated module names are therefore best-effort guesses,
  not authoritative.
- The translated Ruby is meant to read naturally for documentation; it is not
  guaranteed to be runnable against any real Ruby gem.

## Naming conventions

| TypeScript | Ruby | Notes |
|---|---|---|
| `myMethod`, `myProp`, local vars | `my_method`, `my_prop` | camelCase → snake_case (`toSnakeCase`) |
| `MyClass`, type/enum names | `MyClass` | PascalCase preserved |
| package / namespace / submodule | `JsiiCalc::Submodule` | PascalCased module path (`rubyModuleName`) |
| reserved words (`end`, `class`, `send`, …) | `_end`, `_class`, `_send` | escaped with a leading underscore (`RUBY_RESERVED_NAMES`) |
| acronyms (`vpc`, `s3`, `iam`, …) | `VPC`, `S3`, `IAM` | restored from `CDK_ACRONYMS` / assembly `targets.ruby.acronyms` |

## Structural mappings

- **Imports** → `require` (package deps) / `require_relative` (relative paths);
  scoped names are de-scoped (`@scope/pkg` → `scope-pkg`).
- **`class X extends Y`** → `class X < Y`.
- **`implements I`** → `include I` (behavioral interfaces become Ruby modules).
- **`interface` (data struct)** → omitted; jsii structs are plain Ruby Hashes.
- **`interface` (behavioral)** → `module ... end` with method definitions.
- **`readonly` property** → `attr_reader`; otherwise `attr_accessor`;
  `private` members are prefixed with `private`.
- **Constructor** → `def initialize ... end`.
- **Struct values** → Hash literals with symbol keys (`{ deletion_window_in_days: 7 }`).
- **Struct property access** → Hash lookup (`props[:prop1]`).
- **`this.x`** (field read or write) → `@x`; **`this.method(...)`** →
  `self.method(...)`; bare **`this`** → `self`.
- **Strings** → double-quoted; multi-line strings use heredocs (`<<-'HERE'`);
  template literals use `"#{...}"` interpolation.
- **Builtins** → `console.log` → `puts`, `console.error` → `STDERR.puts`,
  `Math.random` → `rand`.
- **`null` / `undefined`** → `nil`.
- **`a instanceof B`** → `a.is_a?(B)`.
- **Optional chaining `a?.b`** → safe navigation `a&.b`.
- **Operators** → `===`/`!==` → `==`/`!=`; `??` → `||`; `??=` → `||=`;
  `++`/`--` (prefix and postfix) → `+= 1` / `-= 1`.

## Differences from the other target languages

### Submodule access

Ruby is registered as `supportsTransitiveSubmoduleAccess = true`
(`src/languages/target-language.ts`), like Python and C#. The snippet's import
shape is preserved (a single `require`), and namespace-traversing accesses are
kept inline. Unlike Python, however, Ruby has no import aliasing
(`import x as y`), so an alias such as `calc.submodule.MyClass` is resolved to the
**real** module path `JsiiCalc::Submodule::MyClass` rather than the alias.

### Constructs Ruby renders that the others cannot

The following are translated **only** by the Ruby visitor. In Python/Java/C#/Go
they currently produce a broken `(SpreadElement …)` / `(SpreadAssignment …)`
placeholder plus an error diagnostic, because those visitors do not implement
them:

| TypeScript | Ruby | Other languages |
|---|---|---|
| `a !== b` | `a != b` | invalid `a !== b` passed through |
| `a ?? b` | `a \|\| b` | invalid `a ?? b` + error |
| `foo(...items)` | `foo(*items)` | `(SpreadElement …)` placeholder + error |
| `{ ...opts, b: 2 }` | `{ **opts, b: 2 }` | `(SpreadAssignment …)` placeholder + error |
| `i++` / `++i` | `i += 1` | invalid `i++` passed through + error / invalid `++i` |
| `i--` / `--i` | `i -= 1` | invalid `i--` passed through + error / invalid `--i` |
| `expr === other` | `expr == other` | (also handled by the base visitor) |

These cases are covered by Ruby-only test fixtures under `test/translations/`
(`expressions/strict_inequality_and_nullish`, `calls/spread_arguments`,
`expressions/object_spread`, `expressions/increment_decrement`). We deliberately
do **not** add `.py`/`.java`/`.cs`/`.go` fixtures for them, since that would
codify the broken output as "expected". (The non-Ruby fallback for ternaries
and `++`/`--` is asserted by unit tests in `test/languages/default.test.ts`
instead.)

Note: `PostfixUnaryExpression` (`i++` / `i--`) and `ConditionalExpression`
(ternaries) were previously not dispatched by the renderer at all. Supporting
them required a small shared change — `renderer.ts` (dispatch + `AstHandler`),
default handlers in `default.ts` that report the node as unsupported and then
fall back to the renderer's raw-source passthrough (via
`AstRenderer.renderUnsupported`, exactly what undispatched nodes got), and the
pass-throughs in `visualize.ts`. Other languages therefore keep their existing
"unsupported" behaviour; only Ruby translates them.

### Object-literal diagnostics

The base visitor reports *every* non-standard object-literal member
(spreads, methods, getters/setters) as unsupported. Ruby overrides
`objectLiteralExpression` to **allow object spreads** through without an error
(since it renders them as `**expr`), while **still** reporting methods,
getters, and setters — which Ruby cannot translate to valid syntax — and
keeping the "you cannot instantiate an interface with an object literal" check.

## Known limitations / not yet handled

These TypeScript constructs are not specifically handled by the Ruby visitor and
fall back to the renderer's best-effort raw-text passthrough (the same limitation
shared by the other language visitors):

- `while`, classic `for (;;)`, `switch`, object/array destructuring (including
  destructuring arrow parameters), `typeof`, `delete`, and `enum`
  *declarations*. (In practice the example corpus iterates with `for...of`,
  which **is** handled — `xs.each do |x| … end`. The ternary `?:` is also
  handled — Ruby's syntax is identical. Arrow and function expressions with
  simple parameters **are** handled: they render as Ruby lambdas —
  `(bell) => bell.ring()` becomes `->(bell) { bell.ring }` — and the output is
  runnable, because the Ruby runtime coerces Procs into single-method
  interface implementations at jsii call sites.)

The exported helpers `toSnakeCase` and `rubyModuleName` carry the trickiest logic
(acronyms, scoped packages, reserved-word escaping) and have dedicated unit tests
in `test/ruby.test.ts`. The internal `findRubyName` (assembly-aware name
resolution) is not exported and remains covered indirectly through the
translation fixtures (`imports/submodule-import`).
