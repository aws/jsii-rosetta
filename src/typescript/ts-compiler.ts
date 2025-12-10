import * as ts from 'typescript';

export class TypeScriptCompiler {
  private readonly realHost = ts.createCompilerHost(STANDARD_COMPILER_OPTIONS, true);

  /**
   * A compiler-scoped cache to avoid having to re-parse the same library files for every compilation
   */
  private readonly fileCache = new Map<string, ts.SourceFile | undefined>();

  public compileBatchInMemory(
    sources: Array<{ filename: string; contents: string }>,
    currentDirectory?: string,
  ): BatchCompilationResult {
    const filenames = sources.map((s) => (s.filename.endsWith('.ts') ? s.filename : s.filename + '.ts'));
    const sourceFiles = new Map<string, string>();

    for (const [i, source] of sources.entries()) {
      // Append empty export to make each file a module with isolated scope.
      // Without this, TypeScript treats all files in the same compilation as scripts
      // sharing a global scope, causing "Cannot redeclare block-scoped variable" errors
      // when multiple snippets use the same variable names.
      // We use export {} instead of putting snippets in separate directories because
      // that would break relative import paths within snippets.
      // Appended (not prepended) to preserve line numbers for error reporting.
      // Hide the export statement from translation since it's synthetic
      sourceFiles.set(filenames[i], `${source.contents}\n/// !hide\nexport {};\n/// !show\n`);
    }

    const host = this.createInMemoryCompilerHost(sourceFiles, currentDirectory);
    const program = ts.createProgram({
      rootNames: filenames,
      options: STANDARD_COMPILER_OPTIONS,
      host,
    });

    const rootFiles = filenames.map((filename) => {
      const rootFile = program.getSourceFile(filename);
      if (rootFile == null) {
        throw new Error(`Oopsie -- couldn't find root file back: ${filename}`);
      }
      return rootFile;
    });

    return { program, rootFiles };
  }

  private createInMemoryCompilerHost(sourceFiles: Map<string, string>, currentDirectory?: string): ts.CompilerHost {
    const realHost = this.realHost;
    const parsedSources = new Map<string, ts.SourceFile>();

    for (const [filename, contents] of sourceFiles) {
      parsedSources.set(filename, ts.createSourceFile(filename, contents, ts.ScriptTarget.Latest));
    }

    return {
      ...realHost,
      fileExists: (filePath) =>
        sourceFiles.has(filePath) || this.fileCache.has(filePath) || realHost.fileExists(filePath),
      getCurrentDirectory: currentDirectory != null ? () => currentDirectory : realHost.getCurrentDirectory,
      getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
        const parsed = parsedSources.get(fileName);
        if (parsed) {
          return parsed;
        }

        const existing = this.fileCache.get(fileName);
        if (existing) {
          return existing;
        }

        const result = realHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
        this.fileCache.set(fileName, result);
        return result;
      },
      readFile: (filePath) => sourceFiles.get(filePath) ?? realHost.readFile(filePath),
      writeFile: () => void undefined,
    };
  }
}

export interface CompilationResult {
  program: ts.Program;
  rootFile: ts.SourceFile;
}

export interface BatchCompilationResult {
  program: ts.Program;
  rootFiles: ts.SourceFile[];
}

export const STANDARD_COMPILER_OPTIONS: ts.CompilerOptions = {
  alwaysStrict: true,
  charset: 'utf8',
  declaration: true,
  declarationMap: true,
  experimentalDecorators: true,
  inlineSourceMap: true,
  inlineSources: true,
  lib: ['lib.es2022.d.ts'],
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  noEmitOnError: true,
  noFallthroughCasesInSwitch: true,
  noImplicitAny: true,
  noImplicitReturns: true,
  noImplicitThis: true,
  noUnusedLocals: false, // Important, becomes super annoying without this
  noUnusedParameters: false, // Important, becomes super annoying without this
  resolveJsonModule: true,
  strict: true,
  strictNullChecks: true,
  strictPropertyInitialization: true,
  stripInternal: true,
  target: ts.ScriptTarget.ES2022,
  // Incremental builds
  incremental: true,
  tsBuildInfoFile: '.tsbuildinfo',
};
