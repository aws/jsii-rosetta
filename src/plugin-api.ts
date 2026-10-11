/**
 * The API available to jsii-rosetta language plugins.
 *
 * A plugin should import from this module, and from
 * `jsii-rosetta/lib/testing/translations-corpus` to test its visitor against
 * the translations corpus. Everything else in jsii-rosetta is internal and may
 * change in any release; what is exported here is versioned by
 * `PLUGIN_API_VERSION`, and `registerTargetLanguage` refuses a plugin that
 * declares an incompatible version.
 *
 * Unlike a jsii-pacmak target, a visitor is built from rosetta's own syntax
 * tree machinery, so this surface is larger: it is the set the reference Ruby
 * plugin needs, and nothing it does not.
 *
 * @experimental while `PLUGIN_API_VERSION` is 0.x, any minor version may break
 * plugins.
 */

// Registration, and the version contract.
export { isCompatiblePluginApi, PLUGIN_API_VERSION } from './plugins';
export {
  type LanguageContext,
  registerTargetLanguage,
  type RegisterTargetLanguageOptions,
  type VisitorFactory,
  visitorFactoryFor,
} from './languages';
export { TargetLanguage } from './languages/target-language';

// Building a visitor.
export { DefaultVisitor } from './languages/default';
export { AstRenderer, type CommentSyntax } from './renderer';
export { NO_SYNTAX, OTree } from './o-tree';
export { SubmoduleReference } from './submodule-reference';
export { type ImportStatement } from './typescript/imports';
export { matchAst, nodeOfType, stripCommentMarkers, voidExpressionString } from './typescript/ast-utils';
export {
  inferredTypeOfExpression,
  isEnumAccess,
  isStaticReadonlyAccess,
  parameterAcceptsUndefined,
} from './typescript/types';
export { analyzeObjectLiteral, type ObjectLiteralStruct } from './jsii/jsii-types';
export {
  analyzeStructType,
  isJsiiProtocolType,
  type JsiiSymbol,
  lookupJsiiSymbolFromNode,
  simpleName,
} from './jsii/jsii-utils';
export { jsiiTargetParameter } from './jsii/packages';

// Translating with a registered language.
export { translateTypeScript } from './translate';
export { extractSnippets, type ExtractOptions, type ExtractResult } from './commands/extract';
export { type ApiLocation } from './snippet';
export { enforcesStrictMode } from './strict';
