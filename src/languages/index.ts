import { CSharpVisitor } from './csharp';
import { GoVisitor } from './go';
import { JavaVisitor } from './java';
import { PythonVisitor } from './python';
import { TargetLanguage } from './target-language';
import { VisualizeAstVisitor } from './visualize';
import { AstHandler } from '../renderer';

export { TargetLanguage };

export interface VisitorFactory {
  readonly version: string;
  createVisitor(): AstHandler<any>;

  /**
   * Told what this process is translating for, before any translation happens.
   *
   * Optional, and no built-in language implements it: Java and C# reach a type
   * through a namespace import, and none of them render an enum member
   * differently from a static property, so the assembly tells them nothing
   * they need. A language where those differ has no other source for the
   * answer, because a published example does not typecheck.
   *
   * May be called more than once (a worker handles many batches), so
   * implementations must be idempotent.
   */
  prepare?(context: LanguageContext): void;
}

/** What a language is translating for. */
export interface LanguageContext {
  /**
   * Package directories of the assemblies whose examples are being translated.
   * Locations rather than loaded assemblies: an assembly runs to tens of
   * megabytes, and a language should read only the parts it needs.
   */
  readonly assemblyLocations: readonly string[];
}

export const TARGET_LANGUAGES: { [key in TargetLanguage]: VisitorFactory } = {
  [TargetLanguage.PYTHON]: {
    version: PythonVisitor.VERSION,
    createVisitor: () => new PythonVisitor(),
  },
  [TargetLanguage.CSHARP]: {
    version: CSharpVisitor.VERSION,
    createVisitor: () => new CSharpVisitor(),
  },
  [TargetLanguage.JAVA]: {
    version: JavaVisitor.VERSION,
    createVisitor: () => new JavaVisitor(),
  },
  [TargetLanguage.GO]: {
    version: GoVisitor.VERSION,
    createVisitor: () => new GoVisitor(),
  },
};

/**
 * Externally-registered target languages (language plugins).
 *
 * The plugin API is experimental: visitors extend internal interfaces
 * (`AstHandler`, `DefaultVisitor`, `OTree`, ...) which carry no cross-version
 * compatibility guarantee yet.
 */
const EXTERNAL_TARGET_LANGUAGES: Record<string, VisitorFactory> = {};

/**
 * Registers an external target language, making it resolvable everywhere a
 * built-in language is (snippet translation, tablets, the CLI).
 *
 * @param language the language name. Must not collide with a
 *                 built-in language.
 * @param factory  the visitor factory for the language.
 */
export function registerTargetLanguage(language: string, factory: VisitorFactory): void {
  if (!language) {
    throw new Error('Cannot register a target language with an empty name');
  }
  if (Object.values(TargetLanguage).includes(language as TargetLanguage)) {
    throw new Error(`Cannot register target language '${language}': collides with a built-in language`);
  }
  if (language in EXTERNAL_TARGET_LANGUAGES) {
    throw new Error(`Target language '${language}' is already registered`);
  }
  EXTERNAL_TARGET_LANGUAGES[language] = factory;
}

/**
 * The visitor factory for the given language — built-in or registered — or
 * `undefined` if the language is unknown.
 */
export function visitorFactoryFor(language: string): VisitorFactory | undefined {
  return (TARGET_LANGUAGES as Record<string, VisitorFactory>)[language] ?? EXTERNAL_TARGET_LANGUAGES[language];
}

/**
 * All currently valid target language names (built-in and registered).
 */
export function allTargetLanguages(): string[] {
  return [...Object.values(TargetLanguage), ...Object.keys(EXTERNAL_TARGET_LANGUAGES)];
}

export function getVisitorFromLanguage(language: string | undefined) {
  if (language !== undefined) {
    const factory = visitorFactoryFor(language);
    if (factory === undefined) {
      throw new Error(`Unknown target language: ${language}. Expected one of ${allTargetLanguages().join(', ')}`);
    }
    return factory.createVisitor();
  }
  // Default to visualizing AST, including nodes we don't recognize yet
  return new VisualizeAstVisitor();
}
