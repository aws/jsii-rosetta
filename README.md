# ![jsii](https://raw.githubusercontent.com/aws/jsii/main/logo/png/128.png)

[![Join the chat at https://cdk.Dev](https://img.shields.io/static/v1?label=Slack&message=cdk.dev&color=brightgreen&logo=slack)](https://cdk.dev)
[![All Contributors](https://img.shields.io/github/all-contributors/aws/jsii/main?label=%E2%9C%A8%20All%20Contributors)](#contributors-)
[![Build Status](https://github.com/aws/jsii-rosetta/workflows/build/badge.svg)](https://github.com/aws/jsii-rosetta/actions?query=workflow%3Abuild+branch%3Amain)
[![npm](https://img.shields.io/npm/v/jsii-rosetta?logo=npm)](https://www.npmjs.com/package/jsii-rosetta)

## Overview

`jsii-rosetta` translates code samples contained in jsii libraries from TypeScript to supported *jsii* target languages.
This is what enables the [AWS Cloud Development Kit][cdk] to deliver polyglot documentation from a single codebase!

`jsii-rosetta` leverages knowledge about jsii language translation conventions in order to produce translations. It only
supports a limited set of TypeScript language features (which can be reliably represented in other languages).

[cdk]: https://github.com/aws/aws-cdk

## :question: Documentation

Head over to our [documentation website](https://aws.github.io/jsii)!

The jsii toolchain spreads out on multiple repositories:

- [aws/jsii-compiler](https://github.com/aws/jsii-compiler) is where the `jsii` compiler is maintained (except releases
  in the `1.x` line)
- [aws/jsii-rosetta](https://github.com/aws/jsii-rosetta) is where the `jsii-rosetta` sample code transliteration tool
  is maintained (except releases in the `1.x` line)
- [aws/jsii](https://github.com/aws/jsii) is where the rest of the toolchain is maintained, including:
  - `@jsii/spec`, the package that defines the *`.jsii` assembly* specification
  - `jsii-config`, an interactive tool to help configure your jsii package
  - `jsii-pacmak`, the bindings generator for jsii packages
  - `jsii-reflect`, a higher-level way to process *`.jsii` assemblies*
  - The jsii runtime libraries for the supported jsii target languages
  - `1.x` release lines of `jsii` and `jsii-rosetta`

## :gear: Maintenance & Support

The applicable *Maintenance & Support policy* can be reviewed in [SUPPORT.md](./SUPPORT.md).

The current status of `jsii-rosetta` releases is:

| Release | Status      | EOS        | Comment                                                                                                 |
| ------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `5.8.x` | Current     | TBD        | ![npm](https://img.shields.io/npm/v/jsii-rosetta/v5.8-latest?label=jsii-rosetta%40v5.8-latest&logo=npm) |
| `5.7.x` | Maintenance | 2025-09-15 | ![npm](https://img.shields.io/npm/v/jsii-rosetta/v5.7-latest?label=jsii-rosetta%40v5.7-latest&logo=npm) |
| `5.6.x` | Maintenance | 2025-07-01 | ![npm](https://img.shields.io/npm/v/jsii-rosetta/v5.6-latest?label=jsii-rosetta%40v5.6-latest&logo=npm) |
| `5.5.x` | Maintenance | 2025-05-15 | ![npm](https://img.shields.io/npm/v/jsii-rosetta/v5.5-latest?label=jsii-rosetta%40v5.5-latest&logo=npm) |

## :gear: Contributing

See [CONTRIBUTING](./CONTRIBUTING.md).

## :school_satchel: Getting Started

## Rosetta for example authors

This section describes what to pay attention to when writing examples that will be converted
by Rosetta.

### Making examples compile

The translator can translate both code that completely compiles and typechecks, as well as code that doesn't.

In case of non-compiling samples the translations will be based off of grammatical parsing only. This has the downside
that we do not have the type information available to the exact thing in all instances. Specifically
struct types will not be able to be inferred from object literals. Have a look at the following piece of code:

```ts
someObject.someMethod('foo', {
  bar: 3,
});
```

In non-TypeScript languages, it is important to know the type of the second
argument to the method here. However, without access to the definition of
`someMethod()`, it's impossible for Rosetta to know the type, and hence
it cannot translate the example. It is therefore important to include necessary
imports, variable declarations, etc, to give Rosetta enough information to figure
out what's going on in this code, and the example should read like this:

```ts
import * as myLib from 'some-library';

declare const someObject: myLib.SomeClass;

someObject.someMethod('foo', {
  bar: 3,
});
```

### Enforcing correct examples

By default, Rosetta will accept non-compiling examples. If you set
`jsiiRosetta.strict` to `true` in your `package.json`,
the Rosetta command will fail if any example contains an error:

```js
/// package.json
{
  "jsiiRosetta": {
    "strict": true
  }
}
```

### Fixtures

To avoid having to repeat common setup every time, code samples can use
"fixtures": a source template where the example is inserted. A fixture must
contain the text `/// here` and typically looks like this:

```ts
const * as module from '@some/dependency';

class MyClass {
  constructor() {
    const obj = new MyObject();

    /// here
  }
}
```

The example will be inserted at the location marked as `/// here` and will have
access to `module`, `obj` and `this`.  Any `import` statements found in the
example will automatically be hoisted at the top of the fixture, where they are
guaranteed to be syntactically valid.

The default file loaded as a fixture is called `rosetta/default.ts-fixture` in
the package directory (if it exists).

Examples can request an alternative fixture by specifying a `fixture` parameter
as part of the code block fence:

````text
```ts fixture=some-fixture
````

Or opt out of using the default fixture by specifying `nofixture`:

````text
```ts nofixture
````

To specify fixtures in an `@example` block, use an accompanying `@exampleMetadata` tag:

````text
/**
 * My cool class
 *
 * @exampleMetadata fixture=with-setup
 * @example
 *
 * new MyCoolClass();
 */
````

### Dependencies

When compiling examples, Rosetta will make sure your package itself and all of
its `dependencies` and `peerDependencies` are available in the dependency
closure that your examples will be compiled in.

If there are packages you want to use in an example that should *not* be part
of your package's dependencies, declare them in `jsiiRosetta.exampleDependencies`
in your `package.json`:

```js
/// package.json
{
  "jsiiRosetta": {
    "exampleDependencies": {
      "@some-other/package": "^1.2.3",
      "@yet-another/package": "*",
    }
  }
}
```

You can also set up a directory with correct dependencies yourself, and pass
`--directory` when running `jsii-rosetta extract`. We recommend using the
automatic closure building mechanism and specifying `exampleDependencies` though.

## Rosetta for package publishers

This section describes how Rosetta integrates into your build process.

### Extract

Rosetta has a number of subcommands. The most important one is `jsii-rosetta extract`.

The `jsii-rosetta extract` command will take one or more jsii assemblies,
extract the snippets from them, will try to compile them with respect to a given
home directory, and finally store all translations in something called a
"tablet".

A couple of things to note here:

- Snippets are always read from the jsii assembly. That means if you make
  changes to examples in source files, you must first re-run `jsii` to
  regenerate the assembly, before re-running `jsii-rosetta extract`.
- The compilation directory will be used to resolve `import`s. Currently, you
  are responsible for building a directory with the correct `node_modules`
  directories in there so that a TypeScript compilation step will find all
  libraries referenced in the examples. This is especially revelant if your
  examples include libraries that depend on the *current* library: it is not
  uncommon to write examples in library `A` showing how to use it in combination
  with library `B`, where `B` depends on `A`. However, since by definition `B`
  *cannot* be in the set of dependencies of `A`, you must build a directory with
  both `B` and `A` in it somewhere in your filesystem and run Rosetta in that
  directory.
- "Extract" will compile samples in parallel. The more assemblies you give it
  at the same time, the more efficient of a job it will be able to do.

The extract command will write a file named `.jsii.tabl.json` next to every
assembly, containing translations for all samples found in the assembly. You
should include this file in your NPM package when you publish, so that
downstream consumers of the package have access to the translations.

An example invocation of `jsii-rosetta extract` looks like this:

```sh
jsii-rosetta extract --directory some/dir $(find . -name .jsii)
```

#### Running in parallel

Since TypeScript compilation takes a lot of time, much time can be gained by
using the CPUs in your system effectively.  `jsii-rosetta extract` will run the
compilations in parallel.

`jsii-rosetta` will use a number of workers equal to half the number of CPU
cores, up to a maximum of 16 workers. This default maximum can be overridden by
setting the `JSII_ROSETTA_MAX_WORKER_COUNT` environment variable.

If you get out of memory errors running too many workers, run a command like
this to raise the memory allowed for your workers:

```sh
/sbin/sysctl -w vm.max_map_count=2251954
```

#### Caching

Rosetta extract will translate all examples found in `.jsii` and write the
translations to `.jsii.tabl.json`. From compilation to compilation, many of these
examples won't have changed. Since TypeScript compilation is a fairly expensive
process, we would like to avoid doing unnecessary work as much as possible.

To that end, rosetta can reuse translations from a cache, and write
new translations into the same cache:

```sh
jsii-rosetta extract \
  --directory some/dir \
  --cache cache.json \
  [--trim-cache] \
  $(find . -name .jsii)
```

The `--trim-cache` flag will remove any old translations from the cache that
don't exist anymore in any of the given assemblies. This prevents the cache from
growing endlessly over time (an equivalent `jsii-rosetta trim-cache` command is
available if your workflow involves running `extract` in multiple distinct
invocations and want to retain the cache between them).

### Infuse

The `jsii-rosetta infuse` command increases the coverage of examples for classes
in the assembly.

It finds classes in the assembly that don't have an example associated with them
yet (as specified via the `@example` tag in the doc comments), but that are used
in another example found elsewhere—in either a `README` or an example of another
class—it will copy the example to all classes involved.  This will make sure
your handwritten examples go as far as possible.

Note that in order to do this, `infuse` will *modify* the assemblies it is
given.

`rosetta infuse` depends on the analysis perfomed by `rosetta extract`, and must
therefore be run after `extract`. It can also be run as part of `extract`, by
passing the `--infuse` flag:

```sh
jsii-rosetta extract \
  --directory some/dir \
  --infuse \
  $(find . -name .jsii)
```

### Translations and pacmak

`jsii-pacmak` will read translation from tablets to substitute translated examples
into the generated source bindings. `pacmak` will automatically read individual
`.jsii.tabl.json` files if present, and can additionally also read from a global
tablet file.

When a translation for a code sample cannot be found, `pacmak` can be configured
to do one of the following:

- Leave the sample untranslated (default)
- Translate the sample in-place (this will slow down generation a lot, and you
  will not have the fine control over the compilation environment that you would
  have if you were to use the `extract` command)
- Fail

Example:

```sh
jsii-pacmak \
  [--rosetta-tablet=global.json] \
  [--rosetta-unknown-snippets=verbatim|translate|fail]
```

### Data flow

The diagram below shows how data flows through the jsii tools when used together:

```text
┌───────────┐
│           │
│  Source   ├───┐
│           │   │    ╔══════════╗    ┌────────────┐     ╔═══════════════╗    ┌──────────┐
└───────────┘   │    ║          ║    │            │     ║    rosetta    ║    │          │
                ├───▶║   jsii   ║───▶│  assembly  │────▶║    extract    ║───▶│  tablet  │
┌───────────┐   │    ║          ║    │            │     ║               ║    │          │
│           │   │    ╚══════════╝    └────────────┘     ╚═══════════════╝    └──────────┘
│  README   │───┘                           │                                      │
│           │                               │                                      │
└───────────┘                               │           ╔═══════════════╗          │
                                            │           ║    rosetta    ║          │
                                            └──────────▶║    infuse     ║◀─────────┘
                                                        ║               ║
                                                        ╚═══════════════╝
                                                                │
                                            ┌───────────────────┴───────────────────┐
                                            │                                       │
                                            ▼                                       ▼
                                     ┌────────────┐                           ┌──────────┐
                                     │            │                           │          │
                                     │ assembly'  │                           │ tablet'  │
                                     │            │                           │          │
                                     └────────────┘                           └──────────┘
                                            │                                       │
                                            │                                       │
                                            │                                       ▼              ┌─────────────┐
                                            │                               ╔═══════════════╗     ┌┴────────────┐│
                                            │                               ║               ║     │             ││
                                            └──────────────────────────────▶║    pacmak     ║────▶│  packages   ││
                                                                            ║               ║     │             ├┘
                                                                            ╚═══════════════╝     └─────────────┘
                                                                               (potentially
                                                                             live-translates)
```

## Advanced topics

### Hiding code from samples

In order to make examples compile, boilerplate code may need to be added that detracts from the example at hand (such as
variable declarations and imports).

This package supports hiding parts of the original source after translation.

To mark special locations in the source tree, we can use one of three mechanisms:

- Use a `void` expression statement to mark statement locations in the AST.
- Use the `comma` operator combined with a `void` expression to mark expression locations in the AST.
- Use special directive comments (`/// !hide`, `/// !show`) to mark locations that span AST nodes. This is less reliable
  (because the source location of translated syntax sometimes will have to be estimated) but the only option if you want
  to mark non-contiguous nodes (such as hide part of a class declaration but show statements inside the constructor).

The `void` expression keyword and or the `comma` operator feature are little-used JavaScript features that are reliably
parsed by TypeScript and do not affect the semantics of the application in which they appear (so the program executes
the same with or without them).

A handy mnemonic for this feature is that you can use it to "send your code into the void".

#### Hiding statements

Statement hiding looks like this:

```ts
before(); // will be shown

void 0; // start hiding (the argument to 'void' doesn't matter)
middle(); // will not be shown
void 'show'; // stop hiding

after(); // will be shown again
```

#### Hiding expressions

For hiding expressions, we use `comma` expressions to attach a `void` statement to an expression value without changing
the meaning of the code.

Example:

```ts
foo(1, 2, (void 1, 3));
```

Will render as

```ts
foo(1, 2)
```

Also supports a visible ellipsis:

```ts
const x = (void '...', 3);
```

Renders to:

```ts
x = ...
```

#### Hiding across AST nodes

Use special comment directives:

```ts
before();
/// !hide
notShown();
/// !show
after();
```

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/costleya"><img src="https://avatars2.githubusercontent.com/u/1572163?v=4?s=100" width="100px;" alt="Aaron Costley"/><br /><sub><b>Aaron Costley</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Acostleya+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=costleya" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Acostleya+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Acostleya" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ahodieb"><img src="https://avatars1.githubusercontent.com/u/835502?v=4?s=100" width="100px;" alt="Abdallah Hodieb"/><br /><sub><b>Abdallah Hodieb</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aahodieb+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://endoflineblog.com/"><img src="https://avatars2.githubusercontent.com/u/460937?v=4?s=100" width="100px;" alt="Adam Ruka"/><br /><sub><b>Adam Ruka</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Askinny85+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=skinny85" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Askinny85" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Askinny85" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/agdimech"><img src="https://avatars.githubusercontent.com/u/51220968?v=4?s=100" width="100px;" alt="Adrian Dimech"/><br /><sub><b>Adrian Dimech</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=agdimech" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://adrianhesketh.com/"><img src="https://avatars.githubusercontent.com/u/1029947?v=4?s=100" width="100px;" alt="Adrian Hesketh"/><br /><sub><b>Adrian Hesketh</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=a-h" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://softwhat.com/"><img src="https://avatars0.githubusercontent.com/u/4362270?v=4?s=100" width="100px;" alt="Alex Pulver"/><br /><sub><b>Alex Pulver</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aalexpulver+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://aws.amazon.com/"><img src="https://avatars.githubusercontent.com/u/54958958?v=4?s=100" width="100px;" alt="Amazon GitHub Automation"/><br /><sub><b>Amazon GitHub Automation</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=amazon-auto" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/andipabst"><img src="https://avatars.githubusercontent.com/u/9639382?v=4?s=100" width="100px;" alt="Andi Pabst"/><br /><sub><b>Andi Pabst</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aandipabst+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/rectalogic"><img src="https://avatars.githubusercontent.com/u/11581?v=4?s=100" width="100px;" alt="Andrew Wason"/><br /><sub><b>Andrew Wason</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Arectalogic+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=rectalogic" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.aslezak.com/"><img src="https://avatars2.githubusercontent.com/u/6944605?v=4?s=100" width="100px;" alt="Andy Slezak"/><br /><sub><b>Andy Slezak</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=amslezak" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ansgar.dev"><img src="https://avatars.githubusercontent.com/u/1112056?v=4?s=100" width="100px;" alt="Ansgar Mertens"/><br /><sub><b>Ansgar Mertens</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Aansgarm" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=ansgarm" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Aansgarm+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/anshulguleria"><img src="https://avatars3.githubusercontent.com/u/993508?v=4?s=100" width="100px;" alt="Anshul Guleria"/><br /><sub><b>Anshul Guleria</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aanshulguleria+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/aripalo/"><img src="https://avatars0.githubusercontent.com/u/679146?v=4?s=100" width="100px;" alt="Ari Palo"/><br /><sub><b>Ari Palo</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aaripalo+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://armaan.tobaccowalla.com"><img src="https://avatars.githubusercontent.com/u/13340433?v=4?s=100" width="100px;" alt="Armaan Tobaccowalla"/><br /><sub><b>Armaan Tobaccowalla</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AArmaanT+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/BiDzej"><img src="https://avatars1.githubusercontent.com/u/26255490?v=4?s=100" width="100px;" alt="Bartłomiej Jurek"/><br /><sub><b>Bartłomiej Jurek</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ABiDzej+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://twiiter.com/benbridts"><img src="https://avatars0.githubusercontent.com/u/1301221?v=4?s=100" width="100px;" alt="Ben Bridts"/><br /><sub><b>Ben Bridts</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=benbridts" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/BenChaimberg"><img src="https://avatars.githubusercontent.com/u/3698184?v=4?s=100" width="100px;" alt="Ben Chaimberg"/><br /><sub><b>Ben Chaimberg</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=BenChaimberg" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/benfarr"><img src="https://avatars0.githubusercontent.com/u/10361379?v=4?s=100" width="100px;" alt="Ben Farr"/><br /><sub><b>Ben Farr</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=benfarr" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/BenWal"><img src="https://avatars0.githubusercontent.com/u/2656067?v=4?s=100" width="100px;" alt="Ben Walters"/><br /><sub><b>Ben Walters</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ABenWal+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://macher.dev"><img src="https://avatars0.githubusercontent.com/u/32685580?v=4?s=100" width="100px;" alt="Benjamin Macher"/><br /><sub><b>Benjamin Macher</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=bmacher" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bmaizels"><img src="https://avatars1.githubusercontent.com/u/36682168?v=4?s=100" width="100px;" alt="Benjamin Maizels"/><br /><sub><b>Benjamin Maizels</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=bmaizels" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Abmaizels" title="Reviewed Pull Requests">👀</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://berviantoleo.my.id/"><img src="https://avatars.githubusercontent.com/u/15927349?v=4?s=100" width="100px;" alt="Bervianto Leo Pratama"/><br /><sub><b>Bervianto Leo Pratama</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Aberviantoleo" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://wcauchois.github.io/"><img src="https://avatars1.githubusercontent.com/u/300544?v=4?s=100" width="100px;" alt="Bill Cauchois"/><br /><sub><b>Bill Cauchois</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Awcauchois+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bverhoeve"><img src="https://avatars1.githubusercontent.com/u/46007524?v=4?s=100" width="100px;" alt="Brecht Verhoeve"/><br /><sub><b>Brecht Verhoeve</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Abverhoeve+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://bdawg.org/"><img src="https://avatars1.githubusercontent.com/u/92937?v=4?s=100" width="100px;" alt="Breland Miley"/><br /><sub><b>Breland Miley</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=mindstorms6" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/CaerusKaru"><img src="https://avatars3.githubusercontent.com/u/416563?v=4?s=100" width="100px;" alt="CaerusKaru"/><br /><sub><b>CaerusKaru</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=CaerusKaru" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3ACaerusKaru" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/comcalvi"><img src="https://avatars.githubusercontent.com/u/66279577?v=4?s=100" width="100px;" alt="Calvin Combs"/><br /><sub><b>Calvin Combs</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=comcalvi" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Acomcalvi" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://camilobermudez85.github.io/"><img src="https://avatars0.githubusercontent.com/u/7834055?v=4?s=100" width="100px;" alt="Camilo Bermúdez"/><br /><sub><b>Camilo Bermúdez</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Acamilobermudez85+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/campionfellin"><img src="https://avatars3.githubusercontent.com/u/11984923?v=4?s=100" width="100px;" alt="Campion Fellin"/><br /><sub><b>Campion Fellin</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=campionfellin" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/carterv"><img src="https://avatars2.githubusercontent.com/u/1551538?v=4?s=100" width="100px;" alt="Carter Van Deuren"/><br /><sub><b>Carter Van Deuren</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Acarterv+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/cgarvis"><img src="https://avatars.githubusercontent.com/u/213125?v=4?s=100" width="100px;" alt="Chris Garvis"/><br /><sub><b>Chris Garvis</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=cgarvis" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://christianmoore.me/"><img src="https://avatars.githubusercontent.com/u/36210509?v=4?s=100" width="100px;" alt="Christian Moore"/><br /><sub><b>Christian Moore</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ashamelesscookie+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ChristopheVico"><img src="https://avatars.githubusercontent.com/u/56592817?v=4?s=100" width="100px;" alt="Christophe Vico"/><br /><sub><b>Christophe Vico</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AChristopheVico+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/christophercurrie"><img src="https://avatars0.githubusercontent.com/u/19510?v=4?s=100" width="100px;" alt="Christopher Currie"/><br /><sub><b>Christopher Currie</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=christophercurrie" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Achristophercurrie+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://rybicki.io/"><img src="https://avatars2.githubusercontent.com/u/5008987?v=4?s=100" width="100px;" alt="Christopher Rybicki"/><br /><sub><b>Christopher Rybicki</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=Chriscbr" title="Documentation">📖</a> <a href="https://github.com/aws/jsii/issues?q=author%3AChriscbr+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=Chriscbr" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/CommanderRoot"><img src="https://avatars.githubusercontent.com/u/4395417?v=4?s=100" width="100px;" alt="CommanderRoot"/><br /><sub><b>CommanderRoot</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=CommanderRoot" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/corymhall"><img src="https://avatars.githubusercontent.com/u/43035978?v=4?s=100" width="100px;" alt="Cory Hall"/><br /><sub><b>Cory Hall</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Acorymhall+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://mcristi.wordpress.com"><img src="https://avatars.githubusercontent.com/u/95209?v=4?s=100" width="100px;" alt="Cristian Măgherușan-Stanciu"/><br /><sub><b>Cristian Măgherușan-Stanciu</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ACristim+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/CyrusNajmabadi"><img src="https://avatars3.githubusercontent.com/u/4564579?v=4?s=100" width="100px;" alt="CyrusNajmabadi"/><br /><sub><b>CyrusNajmabadi</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ACyrusNajmabadi+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii/issues?q=author%3ACyrusNajmabadi+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dsilbergleithcu-godaddy"><img src="https://avatars.githubusercontent.com/u/78872820?v=4?s=100" width="100px;" alt="Damian Silbergleith"/><br /><sub><b>Damian Silbergleith</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=dsilbergleithcu-godaddy" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Adsilbergleithcu-godaddy+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://danieldinu.com/"><img src="https://avatars1.githubusercontent.com/u/236187?v=4?s=100" width="100px;" alt="Daniel Dinu"/><br /><sub><b>Daniel Dinu</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Addinu+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=ddinu" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://danielmschmidt.de/"><img src="https://avatars.githubusercontent.com/u/1337046?v=4?s=100" width="100px;" alt="Daniel Schmidt"/><br /><sub><b>Daniel Schmidt</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ADanielMSchmidt+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=DanielMSchmidt" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://www.udondan.com/"><img src="https://avatars3.githubusercontent.com/u/6443408?v=4?s=100" width="100px;" alt="Daniel Schroeder"/><br /><sub><b>Daniel Schroeder</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Audondan+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=udondan" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=udondan" title="Documentation">📖</a> <a href="https://github.com/aws/jsii/issues?q=author%3Audondan+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Audondan" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/slotnick"><img src="https://avatars3.githubusercontent.com/u/918175?v=4?s=100" width="100px;" alt="Dave Slotnick"/><br /><sub><b>Dave Slotnick</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aslotnick+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dastbe"><img src="https://avatars.githubusercontent.com/u/634735?v=4?s=100" width="100px;" alt="David Bell"/><br /><sub><b>David Bell</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=dastbe" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://caremad.io/"><img src="https://avatars3.githubusercontent.com/u/145979?v=4?s=100" width="100px;" alt="Donald Stufft"/><br /><sub><b>Donald Stufft</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adstufft+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=dstufft" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Adstufft+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Adstufft" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dagnir"><img src="https://avatars2.githubusercontent.com/u/261310?v=4?s=100" width="100px;" alt="Dongie Agnir"/><br /><sub><b>Dongie Agnir</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=dagnir" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Adagnir" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://eduardorabelo.me/"><img src="https://avatars.githubusercontent.com/u/829902?v=4?s=100" width="100px;" alt="Eduardo Rabelo"/><br /><sub><b>Eduardo Rabelo</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=oieduardorabelo" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/edsenabr"><img src="https://avatars3.githubusercontent.com/u/15689137?v=4?s=100" width="100px;" alt="Eduardo Sena S. Rosa"/><br /><sub><b>Eduardo Sena S. Rosa</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aedsenabr+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://eladb.github.com/"><img src="https://avatars3.githubusercontent.com/u/598796?v=4?s=100" width="100px;" alt="Elad Ben-Israel"/><br /><sub><b>Elad Ben-Israel</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aeladb+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=eladb" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Aeladb+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Aeladb" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Aeladb" title="Reviewed Pull Requests">👀</a> <a href="#talk-eladb" title="Talks">📢</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/iliapolo"><img src="https://avatars0.githubusercontent.com/u/1428812?v=4?s=100" width="100px;" alt="Eli Polonsky"/><br /><sub><b>Eli Polonsky</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ailiapolo+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=iliapolo" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Ailiapolo+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Ailiapolo" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Ailiapolo" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://ericzbeard.com/"><img src="https://avatars0.githubusercontent.com/u/663183?v=4?s=100" width="100px;" alt="Eric Z. Beard"/><br /><sub><b>Eric Z. Beard</b></sub></a><br /><a href="#projectManagement-ericzbeard" title="Project Management">📆</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/McDoit"><img src="https://avatars3.githubusercontent.com/u/16723686?v=4?s=100" width="100px;" alt="Erik Karlsson"/><br /><sub><b>Erik Karlsson</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AMcDoit+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kozlove-aws"><img src="https://avatars1.githubusercontent.com/u/68875428?v=4?s=100" width="100px;" alt="Eugene Kozlov"/><br /><sub><b>Eugene Kozlov</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=kozlove-aws" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/FabioGentile"><img src="https://avatars2.githubusercontent.com/u/7030345?v=4?s=100" width="100px;" alt="Fabio Gentile"/><br /><sub><b>Fabio Gentile</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AFabioGentile+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/workeitel"><img src="https://avatars1.githubusercontent.com/u/7794947?v=4?s=100" width="100px;" alt="Florian Eitel"/><br /><sub><b>Florian Eitel</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aworkeitel+label%3Afeature-request" title="Feature requests">🤔</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/gshpychka"><img src="https://avatars.githubusercontent.com/u/23005347?v=4?s=100" width="100px;" alt="Glib Shpychka"/><br /><sub><b>Glib Shpychka</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Agshpychka+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.grahamlea.com/"><img src="https://avatars0.githubusercontent.com/u/754403?v=4?s=100" width="100px;" alt="Graham Lea"/><br /><sub><b>Graham Lea</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AGrahamLea+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3AGrahamLea" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/greglucas"><img src="https://avatars.githubusercontent.com/u/12417828?v=4?s=100" width="100px;" alt="Greg Lucas"/><br /><sub><b>Greg Lucas</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=greglucas" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/assyadh"><img src="https://avatars0.githubusercontent.com/u/4091730?v=4?s=100" width="100px;" alt="Hamza Assyad"/><br /><sub><b>Hamza Assyad</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aassyadh+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=assyadh" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Aassyadh+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Aassyadh" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://harimenon.com/"><img src="https://avatars2.githubusercontent.com/u/171072?v=4?s=100" width="100px;" alt="Hari Pachuveetil"/><br /><sub><b>Hari Pachuveetil</b></sub></a><br /><a href="#blog-floydpink" title="Blogposts">📝</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=floydpink" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/SoManyHs"><img src="https://avatars0.githubusercontent.com/u/29964746?v=4?s=100" width="100px;" alt="Hsing-Hui Hsu"/><br /><sub><b>Hsing-Hui Hsu</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=SoManyHs" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=SoManyHs" title="Documentation">📖</a> <a href="https://github.com/aws/jsii/issues?q=author%3ASoManyHs+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3ASoManyHs" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://bandism.net/"><img src="https://avatars.githubusercontent.com/u/22633385?v=4?s=100" width="100px;" alt="Ikko Ashimine"/><br /><sub><b>Ikko Ashimine</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=eltociear" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Nycto"><img src="https://avatars.githubusercontent.com/u/30517?v=4?s=100" width="100px;" alt="James"/><br /><sub><b>James</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ANycto+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=Nycto" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/JKCT"><img src="https://avatars.githubusercontent.com/u/24870481?v=4?s=100" width="100px;" alt="James Kelley"/><br /><sub><b>James Kelley</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AJKCT+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://jamesmead.org/"><img src="https://avatars2.githubusercontent.com/u/3169?v=4?s=100" width="100px;" alt="James Mead"/><br /><sub><b>James Mead</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=floehopper" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jamesiri"><img src="https://avatars1.githubusercontent.com/u/22601145?v=4?s=100" width="100px;" alt="James Siri"/><br /><sub><b>James Siri</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=jamesiri" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Ajamesiri" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jasdel"><img src="https://avatars3.githubusercontent.com/u/961963?v=4?s=100" width="100px;" alt="Jason Del Ponte"/><br /><sub><b>Jason Del Ponte</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ajasdel+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Ajasdel" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://aws.amazon.com/"><img src="https://avatars1.githubusercontent.com/u/193449?v=4?s=100" width="100px;" alt="Jason Fulghum"/><br /><sub><b>Jason Fulghum</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Afulghum+label%3Afeature-request" title="Feature requests">🤔</a> <a href="#projectManagement-fulghum" title="Project Management">📆</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Afulghum" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jmalins"><img src="https://avatars.githubusercontent.com/u/2001356?v=4?s=100" width="100px;" alt="Jeff Malins"/><br /><sub><b>Jeff Malins</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=jmalins" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Jerry-AWS"><img src="https://avatars3.githubusercontent.com/u/52084730?v=4?s=100" width="100px;" alt="Jerry Kindall"/><br /><sub><b>Jerry Kindall</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=Jerry-AWS" title="Documentation">📖</a> <a href="https://github.com/aws/jsii/issues?q=author%3AJerry-AWS+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://nmussy.github.io/"><img src="https://avatars0.githubusercontent.com/u/2505696?v=4?s=100" width="100px;" alt="Jimmy Gaussen"/><br /><sub><b>Jimmy Gaussen</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Anmussy+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://twitter.com/jowe"><img src="https://avatars.githubusercontent.com/u/569011?v=4?s=100" width="100px;" alt="Johannes Weber"/><br /><sub><b>Johannes Weber</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=johannes-weber" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jpantzlaff"><img src="https://avatars.githubusercontent.com/u/33850400?v=4?s=100" width="100px;" alt="John Pantzlaff"/><br /><sub><b>John Pantzlaff</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=jpantzlaff" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jsteinich"><img src="https://avatars0.githubusercontent.com/u/3868754?v=4?s=100" width="100px;" alt="Jon Steinich"/><br /><sub><b>Jon Steinich</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ajsteinich+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii/issues?q=author%3Ajsteinich+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=jsteinich" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://joekiller.com/"><img src="https://avatars3.githubusercontent.com/u/1022919?v=4?s=100" width="100px;" alt="Joseph Lawson"/><br /><sub><b>Joseph Lawson</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Ajoekiller" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jpmartin2"><img src="https://avatars2.githubusercontent.com/u/2464249?v=4?s=100" width="100px;" alt="Joseph Martin"/><br /><sub><b>Joseph Martin</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ajpmartin2+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dxunix"><img src="https://avatars3.githubusercontent.com/u/11489831?v=4?s=100" width="100px;" alt="Junix"/><br /><sub><b>Junix</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adxunix+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jusdino"><img src="https://avatars.githubusercontent.com/u/11840575?v=4?s=100" width="100px;" alt="Justin Frahm"/><br /><sub><b>Justin Frahm</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ajusdino+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/jsdtaylor"><img src="https://avatars0.githubusercontent.com/u/15832750?v=4?s=100" width="100px;" alt="Justin Taylor"/><br /><sub><b>Justin Taylor</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ajsdtaylor+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kaizen3031593"><img src="https://avatars.githubusercontent.com/u/36202692?v=4?s=100" width="100px;" alt="Kaizen Conroy"/><br /><sub><b>Kaizen Conroy</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=kaizen3031593" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Akaizen3031593+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kaizencc"><img src="https://avatars.githubusercontent.com/u/36202692?v=4?s=100" width="100px;" alt="Kaizen Conroy"/><br /><sub><b>Kaizen Conroy</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=kaizencc" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/z3r0w0n"><img src="https://avatars.githubusercontent.com/u/6740347?v=4?s=100" width="100px;" alt="Kaushik Borra"/><br /><sub><b>Kaushik Borra</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Az3r0w0n+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/aws/aws-cdk"><img src="https://avatars.githubusercontent.com/u/53584728?v=4?s=100" width="100px;" alt="Kendra Neil"/><br /><sub><b>Kendra Neil</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=TheRealAmazonKendra" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/KhurramJalil"><img src="https://avatars.githubusercontent.com/u/114917595?v=4?s=100" width="100px;" alt="Khurram Jalil"/><br /><sub><b>Khurram Jalil</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=KhurramJalil" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://findable.no/"><img src="https://avatars.githubusercontent.com/u/51441?v=4?s=100" width="100px;" alt="Knut O. Hellan"/><br /><sub><b>Knut O. Hellan</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Akhellan+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kiiadi"><img src="https://avatars3.githubusercontent.com/u/4661536?v=4?s=100" width="100px;" alt="Kyle Thomson"/><br /><sub><b>Kyle Thomson</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=kiiadi" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Akiiadi" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://stackoverflow.com/users/2116873/pedreiro"><img src="https://avatars3.githubusercontent.com/u/10764017?v=4?s=100" width="100px;" alt="Leandro Padua"/><br /><sub><b>Leandro Padua</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aleandropadua+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://liangzhou.dev"><img src="https://avatars.githubusercontent.com/u/1444104?v=4?s=100" width="100px;" alt="Liang Zhou"/><br /><sub><b>Liang Zhou</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Alzhoucs+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=lzhoucs" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/madeline-k"><img src="https://avatars.githubusercontent.com/u/80541297?v=4?s=100" width="100px;" alt="Madeline Kusters"/><br /><sub><b>Madeline Kusters</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=madeline-k" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Amadeline-k+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/majasb"><img src="https://avatars2.githubusercontent.com/u/142510?v=4?s=100" width="100px;" alt="Maja S Bratseth"/><br /><sub><b>Maja S Bratseth</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Amajasb+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/marcosdiez"><img src="https://avatars2.githubusercontent.com/u/297498?v=4?s=100" width="100px;" alt="Marcos Diez"/><br /><sub><b>Marcos Diez</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Amarcosdiez+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://polothy.github.io"><img src="https://avatars.githubusercontent.com/u/634657?v=4?s=100" width="100px;" alt="Mark Nielsen"/><br /><sub><b>Mark Nielsen</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=polothy" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.matthewbonig.com/"><img src="https://avatars2.githubusercontent.com/u/1559437?v=4?s=100" width="100px;" alt="Matthew Bonig"/><br /><sub><b>Matthew Bonig</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ambonig+label%3Abug" title="Bug reports">🐛</a> <a href="#blog-mbonig" title="Blogposts">📝</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mpiroc"><img src="https://avatars2.githubusercontent.com/u/1623344?v=4?s=100" width="100px;" alt="Matthew Pirocchi"/><br /><sub><b>Matthew Pirocchi</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=mpiroc" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Ampiroc+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Ampiroc" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://kane.mx"><img src="https://avatars.githubusercontent.com/u/843303?v=4?s=100" width="100px;" alt="Meng Xin Zhu"/><br /><sub><b>Meng Xin Zhu</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Azxkane+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mneil"><img src="https://avatars.githubusercontent.com/u/1605808?v=4?s=100" width="100px;" alt="Michael Neil"/><br /><sub><b>Michael Neil</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Amneil" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mikelane"><img src="https://avatars0.githubusercontent.com/u/6543713?v=4?s=100" width="100px;" alt="Mike Lane"/><br /><sub><b>Mike Lane</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Amikelane+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://elastician.com/"><img src="https://avatars3.githubusercontent.com/u/2056?v=4?s=100" width="100px;" alt="Mitch Garnaat"/><br /><sub><b>Mitch Garnaat</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Agarnaat+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=garnaat" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Agarnaat+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Agarnaat" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MrArnoldPalmer"><img src="https://avatars0.githubusercontent.com/u/7221111?v=4?s=100" width="100px;" alt="Mitchell Valine"/><br /><sub><b>Mitchell Valine</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AMrArnoldPalmer+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=MrArnoldPalmer" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3AMrArnoldPalmer+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3AMrArnoldPalmer" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3AMrArnoldPalmer" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MohamadSoufan"><img src="https://avatars3.githubusercontent.com/u/28849417?v=4?s=100" width="100px;" alt="Mohamad Soufan"/><br /><sub><b>Mohamad Soufan</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=MohamadSoufan" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://moritzkornher.de/"><img src="https://avatars.githubusercontent.com/u/379814?v=4?s=100" width="100px;" alt="Momo Kornher"/><br /><sub><b>Momo Kornher</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=mrgrain" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mmogylenko"><img src="https://avatars.githubusercontent.com/u/7536624?v=4?s=100" width="100px;" alt="Mykola Mogylenko"/><br /><sub><b>Mykola Mogylenko</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ammogylenko+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Naumel"><img src="https://avatars.githubusercontent.com/u/104374999?v=4?s=100" width="100px;" alt="Naumel"/><br /><sub><b>Naumel</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3ANaumel" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/NetaNir"><img src="https://avatars0.githubusercontent.com/u/8578043?v=4?s=100" width="100px;" alt="Neta Nir"/><br /><sub><b>Neta Nir</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=NetaNir" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3ANetaNir+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3ANetaNir" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3ANetaNir" title="Reviewed Pull Requests">👀</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/njlynch"><img src="https://avatars3.githubusercontent.com/u/1376292?v=4?s=100" width="100px;" alt="Nick Lynch"/><br /><sub><b>Nick Lynch</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Anjlynch+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=njlynch" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Anjlynch" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Anjlynch" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nija-at"><img src="https://avatars2.githubusercontent.com/u/16217941?v=4?s=100" width="100px;" alt="Niranjan Jayakar"/><br /><sub><b>Niranjan Jayakar</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Anija-at+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=nija-at" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Anija-at+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Anija-at" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Anija-at" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/NGL321"><img src="https://avatars0.githubusercontent.com/u/4944099?v=4?s=100" width="100px;" alt="Noah Litov"/><br /><sub><b>Noah Litov</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=NGL321" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3ANGL321" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3ANGL321" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://otaviomacedo.github.io/"><img src="https://avatars.githubusercontent.com/u/288203?v=4?s=100" width="100px;" alt="Otavio Macedo"/><br /><sub><b>Otavio Macedo</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=otaviomacedo" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Aotaviomacedo+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Pidz-b"><img src="https://avatars3.githubusercontent.com/u/47750432?v=4?s=100" width="100px;" alt="PIDZ - Bart "/><br /><sub><b>PIDZ - Bart </b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3APidz-b+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/peterwoodworth"><img src="https://avatars.githubusercontent.com/u/44349620?v=4?s=100" width="100px;" alt="Peter Woodworth"/><br /><sub><b>Peter Woodworth</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Apeterwoodworth" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/donicek"><img src="https://avatars.githubusercontent.com/u/8548012?v=4?s=100" width="100px;" alt="Petr Kacer"/><br /><sub><b>Petr Kacer</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adonicek+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://petrabarus.net/"><img src="https://avatars3.githubusercontent.com/u/523289?v=4?s=100" width="100px;" alt="Petra Barus"/><br /><sub><b>Petra Barus</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=petrabarus" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://philcali.me/"><img src="https://avatars1.githubusercontent.com/u/105208?v=4?s=100" width="100px;" alt="Philip Cali"/><br /><sub><b>Philip Cali</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aphilcali+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Kent1"><img src="https://avatars1.githubusercontent.com/u/83018?v=4?s=100" width="100px;" alt="Quentin Loos"/><br /><sub><b>Quentin Loos</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AKent1+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Console32"><img src="https://avatars1.githubusercontent.com/u/4870099?v=4?s=100" width="100px;" alt="Raphael"/><br /><sub><b>Raphael</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AConsole32+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/richardhboyd"><img src="https://avatars0.githubusercontent.com/u/58230111?v=4?s=100" width="100px;" alt="Richard H Boyd"/><br /><sub><b>Richard H Boyd</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Arichardhboyd+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://rix0r.nl/"><img src="https://avatars2.githubusercontent.com/u/524162?v=4?s=100" width="100px;" alt="Rico Huijbers"/><br /><sub><b>Rico Huijbers</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Arix0rrr+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=rix0rrr" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Arix0rrr+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Arix0rrr" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Arix0rrr" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://keybase.io/romainmuller"><img src="https://avatars2.githubusercontent.com/u/411689?v=4?s=100" width="100px;" alt="Romain Marcadier"/><br /><sub><b>Romain Marcadier</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ARomainMuller+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=RomainMuller" title="Code">💻</a> <a href="#design-RomainMuller" title="Design">🎨</a> <a href="https://github.com/aws/jsii/issues?q=author%3ARomainMuller+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3ARomainMuller" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3ARomainMuller" title="Reviewed Pull Requests">👀</a> <a href="#blog-RomainMuller" title="Blogposts">📝</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/sadikkuzu/"><img src="https://avatars2.githubusercontent.com/u/23168063?v=4?s=100" width="100px;" alt="SADIK KUZU"/><br /><sub><b>SADIK KUZU</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Asadikkuzu" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/skarode96"><img src="https://avatars2.githubusercontent.com/u/24491216?v=4?s=100" width="100px;" alt="SK"/><br /><sub><b>SK</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Askarode96+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/spfink"><img src="https://avatars1.githubusercontent.com/u/20525381?v=4?s=100" width="100px;" alt="Sam Fink"/><br /><sub><b>Sam Fink</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=spfink" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Aspfink" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://punch.dev/"><img src="https://avatars1.githubusercontent.com/u/38672686?v=4?s=100" width="100px;" alt="Sam Goodwin"/><br /><sub><b>Sam Goodwin</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Asam-goodwin" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://skorfmann.com/"><img src="https://avatars1.githubusercontent.com/u/136789?v=4?s=100" width="100px;" alt="Sebastian Korfmann"/><br /><sub><b>Sebastian Korfmann</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Askorfmann+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=skorfmann" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3Askorfmann+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://sepehrlaal.com/"><img src="https://avatars.githubusercontent.com/u/5657848?v=4?s=100" width="100px;" alt="Sepehr Laal"/><br /><sub><b>Sepehr Laal</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3A3p3r+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://digitalsanctum.com/"><img src="https://avatars3.githubusercontent.com/u/30923?v=4?s=100" width="100px;" alt="Shane Witbeck"/><br /><sub><b>Shane Witbeck</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adigitalsanctum+label%3Afeature-request" title="Feature requests">🤔</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/shivlaks"><img src="https://avatars0.githubusercontent.com/u/32604953?v=4?s=100" width="100px;" alt="Shiv Lakshminarayan"/><br /><sub><b>Shiv Lakshminarayan</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=shivlaks" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Ashivlaks" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3Ashivlaks" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/SomayaB"><img src="https://avatars3.githubusercontent.com/u/23043132?v=4?s=100" width="100px;" alt="Somaya"/><br /><sub><b>Somaya</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=SomayaB" title="Code">💻</a> <a href="https://github.com/aws/jsii/issues?q=author%3ASomayaB+label%3Afeature-request" title="Feature requests">🤔</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3ASomayaB" title="Maintenance">🚧</a> <a href="https://github.com/aws/jsii-rosetta/pulls?q=is%3Apr+reviewed-by%3ASomayaB" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/skuenzli"><img src="https://avatars.githubusercontent.com/u/869201?v=4?s=100" width="100px;" alt="Stephen Kuenzli"/><br /><sub><b>Stephen Kuenzli</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=skuenzli" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/touchez-du-bois"><img src="https://avatars.githubusercontent.com/u/434017?v=4?s=100" width="100px;" alt="Takahiro Sugiura"/><br /><sub><b>Takahiro Sugiura</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=touchez-du-bois" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitter.im/"><img src="https://avatars2.githubusercontent.com/u/8518239?v=4?s=100" width="100px;" alt="The Gitter Badger"/><br /><sub><b>The Gitter Badger</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=gitter-badger" title="Code">💻</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Agitter-badger" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://medium.com/@thomaspoignant"><img src="https://avatars2.githubusercontent.com/u/17908063?v=4?s=100" width="100px;" alt="Thomas Poignant"/><br /><sub><b>Thomas Poignant</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Athomaspoignant+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ThomasSteinbach"><img src="https://avatars0.githubusercontent.com/u/1683246?v=4?s=100" width="100px;" alt="Thomas Steinbach"/><br /><sub><b>Thomas Steinbach</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AThomasSteinbach+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hoegertn"><img src="https://avatars2.githubusercontent.com/u/1287829?v=4?s=100" width="100px;" alt="Thorsten Hoeger"/><br /><sub><b>Thorsten Hoeger</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=hoegertn" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/serverlessunicorn"><img src="https://avatars1.githubusercontent.com/u/54867311?v=4?s=100" width="100px;" alt="Tim Wagner"/><br /><sub><b>Tim Wagner</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aserverlessunicorn+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii/issues?q=author%3Aserverlessunicorn+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/tobli"><img src="https://avatars3.githubusercontent.com/u/540266?v=4?s=100" width="100px;" alt="Tobias Lidskog"/><br /><sub><b>Tobias Lidskog</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=tobli" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TomBonnerAtDerivitec"><img src="https://avatars.githubusercontent.com/u/83637254?v=4?s=100" width="100px;" alt="Tom Bonner"/><br /><sub><b>Tom Bonner</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ATomBonnerAtDerivitec+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ty.coghlan.dev/"><img src="https://avatars2.githubusercontent.com/u/15920577?v=4?s=100" width="100px;" alt="Ty Coghlan"/><br /><sub><b>Ty Coghlan</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AOphirr33+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/tvanhens"><img src="https://avatars1.githubusercontent.com/u/5342795?v=4?s=100" width="100px;" alt="Tyler van Hensbergen"/><br /><sub><b>Tyler van Hensbergen</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Atvanhens+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://ultidev.com/Products/"><img src="https://avatars1.githubusercontent.com/u/757185?v=4?s=100" width="100px;" alt="Vlad Hrybok"/><br /><sub><b>Vlad Hrybok</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Avgribok+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lanayx"><img src="https://avatars2.githubusercontent.com/u/3329606?v=4?s=100" width="100px;" alt="Vladimir Shchur"/><br /><sub><b>Vladimir Shchur</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ALanayx+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Ragnoroct"><img src="https://avatars.githubusercontent.com/u/19155205?v=4?s=100" width="100px;" alt="Will Bender"/><br /><sub><b>Will Bender</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3ARagnoroct+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://yanex.org/"><img src="https://avatars2.githubusercontent.com/u/95996?v=4?s=100" width="100px;" alt="Yan Zhulanow"/><br /><sub><b>Yan Zhulanow</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=yanex" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yglcode"><img src="https://avatars.githubusercontent.com/u/11893614?v=4?s=100" width="100px;" alt="Yigong Liu"/><br /><sub><b>Yigong Liu</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Ayglcode+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii/issues?q=author%3Ayglcode+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ZachBien"><img src="https://avatars.githubusercontent.com/u/1245628?v=4?s=100" width="100px;" alt="Zach Bienenfeld"/><br /><sub><b>Zach Bienenfeld</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3AZachBien+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ajnarang"><img src="https://avatars3.githubusercontent.com/u/52025281?v=4?s=100" width="100px;" alt="ajnarang"/><br /><sub><b>ajnarang</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aajnarang+label%3Afeature-request" title="Feature requests">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/aniljava"><img src="https://avatars.githubusercontent.com/u/412569?v=4?s=100" width="100px;" alt="aniljava"/><br /><sub><b>aniljava</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=aniljava" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/arnogeurts-sqills"><img src="https://avatars.githubusercontent.com/u/79304871?v=4?s=100" width="100px;" alt="arnogeurts-sqills"/><br /><sub><b>arnogeurts-sqills</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aarnogeurts-sqills+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=arnogeurts-sqills" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/cn-cit"><img src="https://avatars.githubusercontent.com/u/27255477?v=4?s=100" width="100px;" alt="cn-cit"/><br /><sub><b>cn-cit</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Acn-cit+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/deccy-mcc"><img src="https://avatars0.githubusercontent.com/u/45844893?v=4?s=100" width="100px;" alt="deccy-mcc"/><br /><sub><b>deccy-mcc</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adeccy-mcc+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apps/dependabot-preview"><img src="https://avatars3.githubusercontent.com/in/2141?v=4?s=100" width="100px;" alt="dependabot-preview[bot]"/><br /><sub><b>dependabot-preview[bot]</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adependabot-preview[bot]+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Adependabot-preview[bot]" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apps/dependabot"><img src="https://avatars0.githubusercontent.com/in/29110?v=4?s=100" width="100px;" alt="dependabot[bot]"/><br /><sub><b>dependabot[bot]</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Adependabot[bot]" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dheffx"><img src="https://avatars0.githubusercontent.com/u/22029918?v=4?s=100" width="100px;" alt="dheffx"/><br /><sub><b>dheffx</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Adheffx+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/gregswdl"><img src="https://avatars0.githubusercontent.com/u/47365273?v=4?s=100" width="100px;" alt="gregswdl"/><br /><sub><b>gregswdl</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Agregswdl+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/guyroberts21"><img src="https://avatars.githubusercontent.com/u/47118902?v=4?s=100" width="100px;" alt="guyroberts21"/><br /><sub><b>guyroberts21</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=guyroberts21" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mattBrzezinski"><img src="https://avatars.githubusercontent.com/u/4356074?v=4?s=100" width="100px;" alt="mattBrzezinski"/><br /><sub><b>mattBrzezinski</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=mattBrzezinski" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mergify"><img src="https://avatars.githubusercontent.com/u/18240476?v=4?s=100" width="100px;" alt="mergify"/><br /><sub><b>mergify</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Amergify" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apps/mergify"><img src="https://avatars1.githubusercontent.com/in/10562?v=4?s=100" width="100px;" alt="mergify[bot]"/><br /><sub><b>mergify[bot]</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Amergify[bot]" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nathannaveen"><img src="https://avatars.githubusercontent.com/u/42319948?v=4?s=100" width="100px;" alt="nathannaveen"/><br /><sub><b>nathannaveen</b></sub></a><br /><a href="https://github.com/aws/jsii/pulls?q=is%3Apr+author%3Anathannaveen" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/seiyashima"><img src="https://avatars2.githubusercontent.com/u/4947101?v=4?s=100" width="100px;" alt="seiyashima42"/><br /><sub><b>seiyashima42</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Aseiyashima+label%3Abug" title="Bug reports">🐛</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=seiyashima" title="Code">💻</a> <a href="https://github.com/aws/jsii-rosetta/commits?author=seiyashima" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/sullis"><img src="https://avatars3.githubusercontent.com/u/30938?v=4?s=100" width="100px;" alt="sullis"/><br /><sub><b>sullis</b></sub></a><br /><a href="https://github.com/aws/jsii-rosetta/commits?author=sullis" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vaneek"><img src="https://avatars1.githubusercontent.com/u/8113305?v=4?s=100" width="100px;" alt="vaneek"/><br /><sub><b>vaneek</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Avaneek+label%3Abug" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/wendysophie"><img src="https://avatars.githubusercontent.com/u/54415551?v=4?s=100" width="100px;" alt="wendysophie"/><br /><sub><b>wendysophie</b></sub></a><br /><a href="https://github.com/aws/jsii/issues?q=author%3Awendysophie+label%3Abug" title="Bug reports">🐛</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.
Contributions of any kind welcome!

## :balance_scale: License

**jsii** is distributed under the [Apache License, Version 2.0][apache-2.0].

See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for more information.

[apache-2.0]: https://www.apache.org/licenses/LICENSE-2.0
