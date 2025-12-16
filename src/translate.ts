import * as path from 'node:path';
import { inspect } from 'node:util';
import * as ts from 'typescript';

import { TARGET_LANGUAGES, TargetLanguage } from './languages';
import { RecordReferencesVisitor } from './languages/record-references';
import { supportsTransitiveSubmoduleAccess } from './languages/target-language';
import * as logging from './logging';
import { renderTree } from './o-tree';
import { AstRenderer, AstHandler, AstRendererOptions } from './renderer';
import { TypeScriptSnippet, completeSource, SnippetParameters, formatLocation } from './snippet';
import { SubmoduleReference, SubmoduleReferenceMap } from './submodule-reference';
import { ORIGINAL_SNIPPET_KEY } from './tablets/schema';
import { TranslatedSnippet } from './tablets/tablets';
import { SyntaxKindCounter } from './typescript/syntax-kind-counter';
import { TypeScriptCompiler, CompilationResult, BatchCompilationResult } from './typescript/ts-compiler';
import { Spans } from './typescript/visible-spans';
import { annotateStrictDiagnostic, File, hasStrictBranding, mkDict } from './util';

export interface TranslateResult {
  translation: string;
  diagnostics: readonly RosettaDiagnostic[];
}

export function translateTypeScript(
  source: File,
  visitor: AstHandler<any>,
  options: SnippetTranslatorOptions = {},
): TranslateResult {
  const translator = new SnippetTranslator(
    { visibleSource: source.contents, location: { api: { api: 'file', fileName: source.fileName } } },
    options,
  );
  const translated = translator.renderUsing(visitor);

  return {
    translation: translated,
    diagnostics: translator.diagnostics.map(rosettaDiagFromTypescript),
  };
}

/**
 * Translate one or more TypeScript snippets into other languages
 *
 * Can be configured to fully typecheck the samples, or perform only syntactical
 * translation.
 */
export class Translator {
  private readonly compiler = new TypeScriptCompiler();
  #diagnostics: ts.Diagnostic[] = [];

  public get diagnostics(): readonly RosettaDiagnostic[] {
    return ts.sortAndDeduplicateDiagnostics(this.#diagnostics).map(rosettaDiagFromTypescript);
  }

  public constructor(private readonly includeCompilerDiagnostics: boolean) {}

  /**
   * Return the snippet translator for the given snippet
   *
   * We used to cache these, but each translator holds on to quite a bit of memory,
   * so we don't do that anymore.
   */
  public translatorFor(snippet: TypeScriptSnippet) {
    const translator = new SnippetTranslator(snippet, {
      compiler: this.compiler,
      includeCompilerDiagnostics: this.includeCompilerDiagnostics,
    });
    return translator;
  }

  /**
   * Translates a single snippet in its own TS context.
   */
  public translate(snip: TypeScriptSnippet, languages: readonly TargetLanguage[] = Object.values(TargetLanguage)) {
    const translator = this.translatorFor(snip);
    const translated = this.translateSnippet(snip, translator, languages);
    return translated;
  }

  /**
   * Translates a batch of snippets, using a shared TS context.
   */
  public translateSnippets(
    snippets: TypeScriptSnippet[],
    languages: readonly TargetLanguage[] = Object.values(TargetLanguage),
  ): TranslatedSnippet[] {
    const start = performance.now();
    logging.debug(`Translating batch of ${snippets.length} snippets`);

    const res = this.translateBatch(snippets, languages);

    const duration = performance.now() - start;
    logging.debug(
      `Completed batch ${inspect({
        duration: `${(duration / 1000).toFixed(2)}s`,
      })}`,
    );

    return res;
  }

  private translateBatch(
    snippets: TypeScriptSnippet[],
    languages: readonly TargetLanguage[] = Object.values(TargetLanguage),
  ): TranslatedSnippet[] {
    const translatedSnippets: TranslatedSnippet[] = [];

    const batchTranslator = new BatchSnippetTranslator(snippets, {
      compiler: this.compiler,
      includeCompilerDiagnostics: this.includeCompilerDiagnostics,
    });

    for (const [snippet, translator] of batchTranslator) {
      translatedSnippets.push(this.translateSnippet(snippet, translator, languages));
    }

    return translatedSnippets;
  }

  private translateSnippet(
    snippet: TypeScriptSnippet,
    translator: ISnippetTranslator,
    languages: readonly TargetLanguage[],
  ): TranslatedSnippet {
    const translations = mkDict(
      languages.flatMap((lang, idx, array) => {
        if (array.slice(0, idx).includes(lang)) {
          return [];
        }
        const languageConverterFactory = TARGET_LANGUAGES[lang];
        const translated = translator.renderUsing(languageConverterFactory.createVisitor());
        return [[lang, { source: translated, version: languageConverterFactory.version }] as const];
      }),
    );

    if (snippet.parameters?.infused === undefined) {
      this.#diagnostics.push(...translator.diagnostics);
    }

    return TranslatedSnippet.fromSchema({
      translations: {
        ...translations,
        [ORIGINAL_SNIPPET_KEY]: { source: snippet.visibleSource, version: '0' },
      },
      location: snippet.location,
      didCompile: translator.didSuccessfullyCompile,
      fqnsReferenced: translator.fqnsReferenced(),
      fullSource: completeSource(snippet),
      syntaxKindCounter: translator.syntaxKindCounter(),
    });
  }
}

export interface ISnippetTranslator {
  readonly diagnostics: readonly ts.Diagnostic[];
  readonly didSuccessfullyCompile: boolean | undefined;

  renderUsing(visitor: AstHandler<any>): string;
  syntaxKindCounter(): Partial<Record<ts.SyntaxKind, number>>;
  fqnsReferenced(): string[];
}

export interface SnippetTranslatorOptions extends AstRendererOptions {
  /**
   * Re-use the given compiler if given
   */
  readonly compiler?: TypeScriptCompiler;

  /**
   * Include compiler errors in return diagnostics
   *
   * If false, only translation diagnostics will be returned.
   *
   * @default false
   */
  readonly includeCompilerDiagnostics?: boolean;
}

/**
 * Internal implementation of a single TypeScript snippet translator.
 *
 * Consumers should either use `SnippetTranslator` or `BatchSnippetTranslator`.
 */
class InternalSnippetTranslator implements ISnippetTranslator {
  public readonly translateDiagnostics: ts.Diagnostic[] = [];
  public readonly compileDiagnostics: ts.Diagnostic[] = [];

  private readonly visibleSpans: Spans;
  private readonly tryCompile: boolean;
  private readonly submoduleReferences: SubmoduleReferenceMap;

  public constructor(
    snippet: TypeScriptSnippet,
    private readonly compilation: CompilationResult,
    private readonly options: SnippetTranslatorOptions,
  ) {
    // Respect '/// !hide' and '/// !show' directives
    // Use the actual compiled source text to ensure spans match the AST
    this.visibleSpans = Spans.visibleSpansFromSource(compilation.rootFile.text);

    // Find submodule references on explicit imports
    this.submoduleReferences = SubmoduleReference.inSourceFile(
      compilation.rootFile,
      this.compilation.program.getTypeChecker(),
    );

    // This makes it about 5x slower, so only do it on demand
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    this.tryCompile = (this.options.includeCompilerDiagnostics || snippet.strict) ?? false;
    if (this.tryCompile) {
      const program = this.compilation.program;
      const diagnostics = [
        ...neverThrowing(program.getGlobalDiagnostics)(),
        ...neverThrowing(program.getSyntacticDiagnostics)(this.compilation.rootFile),
        ...neverThrowing(program.getDeclarationDiagnostics)(this.compilation.rootFile),
        ...neverThrowing(program.getSemanticDiagnostics)(this.compilation.rootFile),
      ];

      if (snippet.strict) {
        // In a strict assembly, so we'll need to brand all diagnostics here...
        for (const diag of diagnostics) {
          annotateStrictDiagnostic(diag);
        }
      }
      this.compileDiagnostics.push(...diagnostics);
    }
  }

  /**
   * Returns a boolean if compilation was attempted, and undefined if it was not.
   */
  public get didSuccessfullyCompile() {
    return this.tryCompile ? this.compileDiagnostics.length === 0 : undefined;
  }

  public renderUsing(visitor: AstHandler<any>) {
    const converter = new AstRenderer(
      this.compilation.rootFile,
      this.compilation.program.getTypeChecker(),
      visitor,
      this.options,
      // If we support transitive submodule access, don't provide a submodule reference map.
      supportsTransitiveSubmoduleAccess(visitor.language) ? undefined : this.submoduleReferences,
    );
    const converted = converter.convert(this.compilation.rootFile);
    this.translateDiagnostics.push(...filterVisibleDiagnostics(converter.diagnostics, this.visibleSpans));
    return renderTree(converted, { indentChar: visitor.indentChar, visibleSpans: this.visibleSpans });
  }

  public syntaxKindCounter(): Partial<Record<ts.SyntaxKind, number>> {
    const kindCounter = new SyntaxKindCounter(this.visibleSpans);
    return kindCounter.countKinds(this.compilation.rootFile);
  }

  public fqnsReferenced() {
    const visitor = new RecordReferencesVisitor(this.visibleSpans);
    const converter = new AstRenderer(
      this.compilation.rootFile,
      this.compilation.program.getTypeChecker(),
      visitor,
      this.options,
      this.submoduleReferences,
    );
    converter.convert(this.compilation.rootFile);
    return visitor.fqnsReferenced();
  }

  public get diagnostics(): readonly ts.Diagnostic[] {
    return ts.sortAndDeduplicateDiagnostics(this.compileDiagnostics.concat(this.translateDiagnostics));
  }
}

/**
 * Translate a single TypeScript snippet
 */
export class SnippetTranslator extends InternalSnippetTranslator {
  public constructor(snippet: TypeScriptSnippet, options: SnippetTranslatorOptions = {}) {
    const compiler = options.compiler ?? new TypeScriptCompiler();
    const source = completeSource(snippet);
    const fakeCurrentDirectory = snippet.parameters?.[SnippetParameters.$COMPILATION_DIRECTORY] ?? process.cwd();
    const compilation = compiler.compileBatchInMemory(
      [
        {
          filename: removeSlashes(formatLocation(snippet.location)),
          contents: source,
        },
      ],
      fakeCurrentDirectory,
    );

    super(
      snippet,
      {
        program: compilation.program,
        rootFile: compilation.rootFiles[0],
      },
      options,
    );
  }
}

export interface BatchSnippetTranslatorOptions extends SnippetTranslatorOptions {
  /**
   * What directory to pretend the file is in (system parameter)
   *
   * Attached when compiling a literate file, as they compile in
   * the location where they are stored.
   *
   * @default - current working directory
   */
  readonly compilationDirectory?: string;
}

/**
 * Translate a single TypeScript snippet
 */
export class BatchSnippetTranslator {
  private readonly compilation: BatchCompilationResult;

  public constructor(
    private readonly snippets: TypeScriptSnippet[],
    private readonly options: BatchSnippetTranslatorOptions = {},
  ) {
    const compiler = options.compiler ?? new TypeScriptCompiler();
    const workingDir = options.compilationDirectory ?? process.cwd();

    const sources = snippets.map((snippet) => {
      const snippetLoc = snippet.parameters?.[SnippetParameters.$COMPILATION_DIRECTORY];
      const filename = removeSlashes(formatLocation(snippet.location));

      return {
        filename: snippetLoc ? path.relative(workingDir, path.join(snippetLoc, filename)) : filename,
        contents: completeSource(snippet),
      };
    });
    this.compilation = compiler.compileBatchInMemory(sources, workingDir);
  }

  *[Symbol.iterator](): Generator<[TypeScriptSnippet, ISnippetTranslator], void, unknown> {
    for (const [idx, snippet] of this.snippets.entries()) {
      const rootFile = this.compilation.rootFiles[idx];

      const translator: ISnippetTranslator = new InternalSnippetTranslator(
        snippet,
        {
          program: this.compilation.program,
          rootFile,
        },
        this.options,
      );

      yield [snippet, translator];
    }
  }
}

/**
 * Intercepts all exceptions thrown by the wrapped call, and logs them to
 * console.error instead of re-throwing, then returns an empty array. This
 * is here to avoid compiler crashes due to broken code examples that cause
 * the TypeScript compiler to hit a "Debug Failure".
 */
function neverThrowing<A extends unknown[], R>(call: (...args: A) => readonly R[]): (...args: A) => readonly R[] {
  return (...args: A) => {
    try {
      return call(...args);
    } catch (err: any) {
      const isExpectedTypescriptError = err.message.includes('Debug Failure');

      if (!isExpectedTypescriptError) {
        console.error(`Failed to execute ${call.name}: ${err}`);
      }

      return [];
    }
  };
}

/**
 * Hide diagnostics that are rosetta-sourced if they are reported against a non-visible span
 */
function filterVisibleDiagnostics(diags: readonly ts.Diagnostic[], visibleSpans: Spans): ts.Diagnostic[] {
  return diags.filter((d) => d.source !== 'rosetta' || d.start === undefined || visibleSpans.containsPosition(d.start));
}

/**
 * A translation of a TypeScript diagnostic into a data-only representation for Rosetta
 *
 * We cannot use the original `ts.Diagnostic` since it holds on to way too much
 * state (the source file and by extension the entire parse tree), which grows
 * too big to be properly serialized by a worker and also takes too much memory.
 *
 * Reduce it down to only the information we need.
 */
export interface SnippetTimingInfo {
  readonly snippetKey: string;
  readonly durationMs: number;
}

export interface RosettaDiagnostic {
  /**
   * If this is an error diagnostic or not
   */
  readonly isError: boolean;

  /**
   * If the diagnostic was emitted from an assembly that has its 'strict' flag set
   */
  readonly isFromStrictAssembly: boolean;

  /**
   * The formatted message, ready to be printed (will have colors and newlines in it)
   *
   * Ends in a newline.
   */
  readonly formattedMessage: string;

  /**
   * Optional timing information for snippet translation
   */
  readonly timingInfo?: SnippetTimingInfo;
}

export function makeRosettaDiagnostic(isError: boolean, formattedMessage: string): RosettaDiagnostic {
  return { isError, formattedMessage, isFromStrictAssembly: false };
}

export function makeTimingDiagnostic(snippetKey: string, durationMs: number): RosettaDiagnostic {
  return {
    isError: false,
    isFromStrictAssembly: false,
    formattedMessage: '',
    timingInfo: { snippetKey, durationMs },
  };
}

export function extractTimingInfo(diagnostics: readonly RosettaDiagnostic[]): {
  timings: SnippetTimingInfo[];
  diagnostics: RosettaDiagnostic[];
} {
  const timings: SnippetTimingInfo[] = [];
  const regular: RosettaDiagnostic[] = [];

  for (const diag of diagnostics) {
    if (diag.timingInfo) {
      timings.push(diag.timingInfo);
    } else {
      regular.push(diag);
    }
  }

  return { timings, diagnostics: regular };
}

export function formatTimingTable(timings: SnippetTimingInfo[]): string {
  if (timings.length === 0) {
    return '';
  }

  const totalTime = timings.reduce((sum, t) => sum + t.durationMs, 0);
  const sorted = timings.sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);

  const lines = [
    '',
    '=== Top 10 Slowest Snippets ===',
    'Rank | Time (s) | % of Total | Snippet Key',
    '-----|----------|------------|------------',
  ];

  for (const [idx, timing] of sorted.entries()) {
    const timeS = (timing.durationMs / 1000).toFixed(2).padStart(8);
    const pct = ((timing.durationMs / totalTime) * 100).toFixed(1).padStart(10);
    lines.push(`${(idx + 1).toString().padEnd(4)} | ${timeS} | ${pct} | ${timing.snippetKey}`);
  }

  lines.push('');
  lines.push(`Total translation time: ${(totalTime / 1000).toFixed(2)}s`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Turn TypeScript diagnostics into Rosetta diagnostics
 */
export function rosettaDiagFromTypescript(diag: ts.Diagnostic): RosettaDiagnostic {
  return {
    isError: diag.category === ts.DiagnosticCategory.Error,
    isFromStrictAssembly: hasStrictBranding(diag),
    formattedMessage: ts.formatDiagnosticsWithColorAndContext([diag], DIAG_HOST),
  };
}

const DIAG_HOST = {
  getCurrentDirectory() {
    return '.';
  },
  getCanonicalFileName(fileName: string) {
    return fileName;
  },
  getNewLine() {
    return '\n';
  },
};

/**
 * Remove slashes from a "where" description, as the TS compiler will interpret it as a directory
 * and we can't have that for compiling literate files
 */
function removeSlashes(x: string) {
  return x.replace(/\/|\\/g, '.');
}
