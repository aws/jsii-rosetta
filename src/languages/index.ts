import { CSharpVisitor } from './csharp';
import { GoVisitor } from './go';
import { JavaVisitor } from './java';
import { PythonVisitor } from './python';
import { TargetLanguage } from './target-language';
import { VisualizeAstVisitor } from './visualize';
import { isCompatiblePluginApi, PLUGIN_API_VERSION } from '../plugins';
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
 * Null prototype: a language named like an `Object.prototype` member
 * (`toString`, `constructor`, ...) must neither count as already registered
 * nor resolve to an inherited function.
 */
const EXTERNAL_TARGET_LANGUAGES: Record<string, VisitorFactory> = Object.create(null);

export interface RegisterTargetLanguageOptions {
  /**
   * The plugin API version the plugin was written against (`PLUGIN_API_VERSION`
   * of the jsii-rosetta it was built with).
   */
  readonly pluginApiVersion: string;
}

/**
 * Registers an external target language, making it resolvable everywhere a
 * built-in language is: snippet translation, tablets, and translation workers
 * that load the plugin (`jsii-rosetta extract --plugin`).
 *
 * Registering the same language again with the same visitor version does
 * nothing, since a plugin registers when it is loaded and may be loaded more
 * than once. A different version is an error.
 *
 * @param language the language name. Must not collide with a
 *                 built-in language.
 * @param factory  the visitor factory for the language.
 * @param options  the plugin API version the plugin was written against.
 */
export function registerTargetLanguage(
  language: string,
  factory: VisitorFactory,
  options: RegisterTargetLanguageOptions,
): void {
  if (!language) {
    throw new Error('Cannot register a target language with an empty name');
  }
  if (Object.values(TargetLanguage).includes(language as TargetLanguage)) {
    throw new Error(`Cannot register target language '${language}': collides with a built-in language`);
  }
  if (typeof options?.pluginApiVersion !== 'string') {
    throw new Error(
      `Cannot register target language '${language}': the plugin must declare the 'pluginApiVersion' it was written against (this jsii-rosetta implements ${PLUGIN_API_VERSION})`,
    );
  }
  if (!isCompatiblePluginApi(options.pluginApiVersion)) {
    throw new Error(
      `Cannot register target language '${language}': the plugin requires plugin API ${options.pluginApiVersion}, but this jsii-rosetta implements ${PLUGIN_API_VERSION}`,
    );
  }
  const existing = EXTERNAL_TARGET_LANGUAGES[language];
  if (existing !== undefined) {
    if (existing.version === factory.version) {
      return;
    }
    throw new Error(
      `Target language '${language}' is already registered with visitor version ${existing.version}; cannot register version ${factory.version}`,
    );
  }
  EXTERNAL_TARGET_LANGUAGES[language] = factory;
}

/**
 * The visitor factory for the given language — built-in or registered — or
 * `undefined` if the language is unknown.
 */
export function visitorFactoryFor(language: string): VisitorFactory | undefined {
  // An own-property check: TARGET_LANGUAGES is an ordinary object, so a plain
  // lookup of `constructor` would return Object.
  return Object.prototype.hasOwnProperty.call(TARGET_LANGUAGES, language)
    ? TARGET_LANGUAGES[language as TargetLanguage]
    : EXTERNAL_TARGET_LANGUAGES[language];
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
