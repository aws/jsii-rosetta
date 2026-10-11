import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { extract } from 'tar';

import { VisualizeAstVisitor } from '../languages/visualize';
import { AstHandler } from '../renderer';
import { SnippetParameters } from '../snippet';
import { SnippetTranslator } from '../translate';

/**
 * The translations corpus: the collection of TypeScript snippets under this
 * package's `corpus/` directory, together with the fixture assemblies they
 * compile against.
 *
 * The corpus ships in the published package so that external target-language
 * implementations can run the exact same snippets this repository's own
 * translation tests use, contributing only their expected outputs — no
 * vendored copy of the snippets that can drift out of sync.
 *
 * Typical use from a language plugin's test suite:
 *
 * ```ts
 * const corpus = await TranslationsCorpus.create();
 * try {
 *   for (const snippet of corpus.snippets) {
 *     const expected = corpus.expectation(snippet, '.rb', myExpectationsDir);
 *     if (expected === undefined) { continue; } // no expectation yet
 *     const actual = corpus.render(snippet, myVisitorFactory.createVisitor());
 *     assert.equal(normalizeRenderedSource(actual), normalizeExpectedSource(expected));
 *   }
 * } finally {
 *   await corpus.dispose();
 * }
 * ```
 */
export interface TranslationsCorpusOptions {
  /**
   * Directory holding the corpus' TypeScript snippets.
   *
   * @default - the `corpus/` directory shipped with this package
   */
  readonly corpusRoot?: string;

  /**
   * Directory holding the fixture assembly tarballs the snippets may import.
   *
   * @default - the `fixtures/` directory shipped with this package
   */
  readonly fixturesRoot?: string;
}

export interface CorpusSnippet {
  /**
   * Corpus-relative snippet name without its extension (e.g.
   * `calls/method_call`). Expected-output files use this name with a
   * language-specific extension.
   */
  readonly name: string;

  /** Absolute path of the TypeScript source file */
  readonly typeScriptPath: string;

  /** Contents of the TypeScript source file */
  readonly typeScriptSource: string;
}

export class TranslationsCorpus {
  /** The `corpus/` directory shipped with this package */
  public static readonly DEFAULT_CORPUS_ROOT = path.resolve(__dirname, '..', '..', 'corpus');

  /** The `fixtures/` directory shipped with this package */
  public static readonly DEFAULT_FIXTURES_ROOT = path.resolve(__dirname, '..', '..', 'fixtures');

  /**
   * Enumerates the snippet names in a corpus directory, synchronously and
   * without preparing anything for compilation. Test frameworks need the
   * test tree at module-load time, while `create()` is async — so lay out
   * tests over `snippetNames()` and resolve each name against the created
   * corpus inside the tests.
   */
  public static snippetNames(corpusRoot: string = TranslationsCorpus.DEFAULT_CORPUS_ROOT): string[] {
    return allFiles(corpusRoot)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.test.ts'))
      .sort()
      .map((f) => path.relative(corpusRoot, f).replace(/\.ts$/, ''));
  }

  /**
   * Creates a corpus handle: enumerates the snippets and prepares a
   * compilation directory with the fixture packages extracted into its
   * `node_modules`, so snippets that import fixture types compile.
   */
  public static async create(options: TranslationsCorpusOptions = {}): Promise<TranslationsCorpus> {
    const corpusRoot = options.corpusRoot ?? TranslationsCorpus.DEFAULT_CORPUS_ROOT;
    const fixturesRoot = options.fixturesRoot ?? TranslationsCorpus.DEFAULT_FIXTURES_ROOT;

    const compileDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jsii-rosetta-corpus-'));
    const nodeModulesDir = path.resolve(compileDirectory, 'node_modules');

    for (const tarball of await fs.promises.readdir(fixturesRoot)) {
      if (!tarball.endsWith('.tgz')) {
        continue;
      }

      const file = path.join(fixturesRoot, tarball);

      const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), tarball));
      try {
        // Extract just package.json so we can determine the package name...
        await extract({ cwd: workDir, file, filter: (entry) => entry === 'package/package.json', strip: 1 });
        const { name } = JSON.parse(await fs.promises.readFile(path.join(workDir, 'package.json'), 'utf-8'));

        const dest = path.join(nodeModulesDir, ...name.split('/'));
        await fs.promises.mkdir(dest, { recursive: true });
        await extract({ cwd: dest, file, strip: 1 });
      } finally {
        await fs.promises.rm(workDir, { force: true, recursive: true });
      }
    }

    return new TranslationsCorpus(corpusRoot, compileDirectory);
  }

  /** All snippets in the corpus, in stable (sorted) order */
  public readonly snippets: readonly CorpusSnippet[];

  private readonly translators = new Map<string, SnippetTranslator>();

  private constructor(private readonly corpusRoot: string, private readonly compileDirectory: string) {
    this.snippets = allFiles(corpusRoot)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.test.ts'))
      .sort()
      .map((typeScriptPath) => ({
        name: path.relative(corpusRoot, typeScriptPath).replace(/\.ts$/, ''),
        typeScriptPath,
        typeScriptSource: fs.readFileSync(typeScriptPath, { encoding: 'utf-8' }),
      }));
  }

  /** Looks up a snippet by its corpus-relative name (see `snippetNames`) */
  public snippet(name: string): CorpusSnippet | undefined {
    return this.snippets.find((s) => s.name === name);
  }

  /**
   * The path where the expected output of `snippet` for a language using
   * `extension` lives. `expectationsRoot` defaults to the corpus itself
   * (where the in-repo languages keep theirs); external languages pass their
   * own directory, mirroring the corpus' relative layout.
   */
  public expectationPath(snippet: CorpusSnippet, extension: string, expectationsRoot?: string): string {
    return path.join(expectationsRoot ?? this.corpusRoot, `${snippet.name}${extension}`);
  }

  /**
   * The expected output of `snippet` for a language, or `undefined` if no
   * expectation file exists.
   */
  public expectation(snippet: CorpusSnippet, extension: string, expectationsRoot?: string): string | undefined {
    const file = this.expectationPath(snippet, extension, expectationsRoot);
    return fs.existsSync(file) ? fs.readFileSync(file, { encoding: 'utf-8' }) : undefined;
  }

  /**
   * The (cached) translator for a snippet. Constructing one compiles the
   * snippet, so the first call per snippet is the expensive one; every
   * language then renders from the same compilation.
   */
  public translatorFor(snippet: CorpusSnippet): SnippetTranslator {
    let translator = this.translators.get(snippet.name);
    if (translator === undefined) {
      translator = new SnippetTranslator({
        visibleSource: snippet.typeScriptSource,
        location: { api: { api: 'file', fileName: snippet.typeScriptPath }, field: { field: 'example' } },
        parameters: { [SnippetParameters.$COMPILATION_DIRECTORY]: this.compileDirectory },
      });
      this.translators.set(snippet.name, translator);
    }
    return translator;
  }

  /** Renders a snippet using the given visitor */
  public render(snippet: CorpusSnippet, visitor: AstHandler<any>): string {
    return this.translatorFor(snippet).renderUsing(visitor);
  }

  /** Renders a snippet's AST as text — useful in failure output */
  public visualizeAst(snippet: CorpusSnippet): string {
    return this.translatorFor(snippet).renderUsing(new VisualizeAstVisitor(true));
  }

  /** Releases the compilation directory and cached translators */
  public async dispose(): Promise<void> {
    this.translators.clear();
    await fs.promises.rm(this.compileDirectory, { force: true, recursive: true });
  }
}

/**
 * Normalization applied to expectation files before comparison: leading &
 * trailing empty lines are ignored, as is any indentation common to all
 * lines (so expectation files may be indented for readability).
 */
export function normalizeExpectedSource(x: string): string {
  return stripEmptyLines(stripCommonWhitespace(x));
}

/**
 * Normalization applied to rendered translations before comparison: leading
 * & trailing empty lines are ignored.
 */
export function normalizeRenderedSource(x: string): string {
  return stripEmptyLines(x);
}

function allFiles(root: string): string[] {
  const ret: string[] = [];
  recurse(root);
  return ret;

  function recurse(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        ret.push(fullPath);
      }
      if (stat.isDirectory()) {
        recurse(fullPath);
      }
    }
  }
}

function stripCommonWhitespace(x: string) {
  const lines = x.split('\n');
  const whitespaces = lines
    .filter((l) => !emptyLine(l.trim()))
    /* eslint-disable-next-line @typescript-eslint/prefer-regexp-exec */
    .map((l) => l.match(/(\s*)/)![1].length);
  const minWS = Math.min(...whitespaces);
  return lines.map((l) => l.slice(minWS)).join('\n');
}

function stripEmptyLines(x: string) {
  const lines = x.split('\n');
  while (lines.length > 0 && emptyLine(lines[0])) {
    lines.splice(0, 1);
  }
  while (lines.length > 0 && emptyLine(lines[lines.length - 1])) {
    lines.pop();
  }
  return lines.join('\n');
}

function emptyLine(x: string) {
  return x.trim() === '';
}
