import * as ts from 'typescript';
import { DefaultVisitor, isExpressionOfFunctionType } from './default';
import { TargetLanguage } from './target-language';
import { analyzeObjectLiteral, ObjectLiteralStruct } from '../jsii/jsii-types';
import {
  analyzeStructType,
  lookupJsiiSymbolFromNode,
  isJsiiProtocolType,
  JsiiSymbol,
  simpleName,
  namespaceName,
} from '../jsii/jsii-utils';
import { jsiiTargetParameter } from '../jsii/packages';
import { NO_SYNTAX, OTree } from '../o-tree';
import { AstRenderer, CommentSyntax } from '../renderer';
import { SubmoduleReference } from '../submodule-reference';
import { stripCommentMarkers, voidExpressionString, matchAst, nodeOfType } from '../typescript/ast-utils';
import { ImportStatement } from '../typescript/imports';
import {
  isEnumAccess,
  isStaticReadonlyAccess,
  parameterAcceptsUndefined,
  inferredTypeOfExpression,
} from '../typescript/types';

// Ruby keywords and standard reserved names. Since Rosetta translates code snippets
// directly without dynamic target configurations, we use this hardcoded set to escape
// identifiers (e.g. by prefixing with an underscore) to avoid syntax errors in the output.
const RUBY_RESERVED_NAMES = new Set([
  'BEGIN',
  'END',
  'alias',
  'and',
  'begin',
  'break',
  'case',
  'class',
  'def',
  'defined?',
  'do',
  'else',
  'elsif',
  'end',
  'ensure',
  'false',
  'for',
  'if',
  'in',
  'module',
  'next',
  'nil',
  'not',
  'or',
  'redo',
  'rescue',
  'retry',
  'return',
  'self',
  'super',
  'then',
  'true',
  'undef',
  'unless',
  'until',
  'when',
  'while',
  'yield',
  'send',
  '__send__',
]);

function toPascalCase(str: string) {
  return str.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, _sep, char) => char.toUpperCase());
}

/**
 * Escapes a raw string for embedding inside a Ruby double-quoted string. Uses JSON's escaping
 * for quotes, backslashes and control characters, then additionally neutralises Ruby string
 * interpolation sequences (`#{`, `#@`, `#$`) so literal `#`-sequences are not evaluated.
 * Returns the escaped inner content only (without the surrounding quotes).
 */
function rubyDoubleQuotedInner(text: string): string {
  return JSON.stringify(text)
    .slice(1, -1)
    .replace(/#(?=[{@$])/g, '\\#');
}

/**
 * Escapes a literal chunk of a template literal for embedding inside a Ruby double-quoted
 * (interpolating) string. Escapes backslashes, double quotes and Ruby interpolation sequences
 * (`#{`, `#@`, `#$`), but deliberately PRESERVES newlines and other whitespace so multi-line
 * template literals stay multi-line in the output.
 */
function escapeRubyTemplateText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/#(?=[{@$])/g, '\\#');
}

/**
 * Converts a camelCase identifier (e.g. property or method name) to ruby-style snake_case.
 * Assumes class names (starting with an uppercase letter followed by lowercase) should not be converted.
 * Escapes any Ruby keywords/reserved names by prefixing them with an underscore.
 */
export function toSnakeCase(camel: string) {
  if (/^[A-Z][A-Z0-9_]*$/.test(camel)) {
    // Looks like SCREAMING_SNAKE_CASE (a constant, e.g. `FOO_BAR`), leave it untouched.
    return camel;
  }
  if (camel.match(/^[A-Z][a-z]/)) {
    // Looks like PascalCase, probably a class name, don't snake_case
    return camel;
  }
  const snake = camel
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
  return RUBY_RESERVED_NAMES.has(snake) ? `_${snake}` : snake;
}

/**
 * Formats an assembly, package, or namespace segment name into a PascalCased Ruby module name.
 * Handles scoped packages (@scope/name -> Scope::Name), hyphens (jsii-calc -> JsiiCalc),
 * and capitalizes standard/dynamic acronyms while respecting word boundary rules.
 *
 * @param acronyms the acronyms to recognise, from the referenced assembly's
 *   `targets.ruby.acronyms`. The assembly config is the single source of truth
 *   for acronym casing (it is compiler-validated, library-specific data);
 *   rosetta deliberately carries no built-in list — a snippet translated
 *   without assembly info simply gets plain PascalCase.
 */
export function rubyModuleName(name: string, acronyms: string[] = []): string {
  if (name.startsWith('@')) {
    const parts = name.slice(1).split('/');
    return parts.map((p) => rubyModuleName(p, acronyms)).join('::');
  }
  if (name.includes('-')) {
    const parts = name.split('-');
    return parts.map((p) => rubyModuleName(p, acronyms)).join('');
  }
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  let pascal = sanitized.charAt(0) === sanitized.charAt(0).toUpperCase() ? sanitized : toPascalCase(sanitized);

  const allAcronyms = [...new Set(acronyms)];
  // Restore uppercase casing to the caller-declared acronyms in the PascalCase string.
  // We use word-boundary and next-character checks to avoid uppercase conversion inside unrelated
  // words (e.g., capitalizing 'SI' inside 'Simple').
  for (const acronym of allAcronyms) {
    const regex = new RegExp(`(${acronym})`, 'ig');
    pascal = pascal.replace(regex, (match, _p1, offset) => {
      if (match[0] !== match[0].toUpperCase()) return match;
      const nextChar = pascal[offset + match.length];
      if (nextChar) {
        const isValid =
          /^[A-Z0-9]$/.test(nextChar) ||
          (nextChar === 's' &&
            (!pascal[offset + match.length + 1] || /^[A-Z0-9]$/.test(pascal[offset + match.length + 1])));
        if (!isValid) return match;
      }
      return acronym;
    });
  }
  return pascal;
}

/**
 * Best-effort Ruby module name for a jsii module FQN (e.g. `aws-cdk-lib.aws_s3`) when no
 * assembly is loaded. The core CDK library configures its Ruby names explicitly in
 * `.jsiirc.json` (`aws-cdk-lib` -> `AWSCDK`, `aws-s3` -> `S3`, dropping the redundant
 * service-level `aws` prefix); that config is unavailable without the assemblies, so the
 * dominant case is mirrored here to keep snippet namespaces aligned with the compiled gems.
 *
 * NOTE: this special-casing is the one remaining piece of CDK-specific knowledge in this
 * visitor, and it only affects snippets whose type references cannot be resolved to an
 * assembly at all. The structural fix is for callers (which hold the assembly) to supply
 * naming config for unresolved references; until that API exists, this guess keeps
 * non-compiling README snippets readable.
 */
export function guessRubyModuleName(fqn: string): string {
  const [packageName, ...submodulePath] = fqn.split('.');
  const isCoreCdk = packageName === 'aws-cdk-lib';
  const root = isCoreCdk ? 'AWSCDK' : rubyModuleName(packageName);
  const segments = submodulePath.map((s) => rubyModuleName(isCoreCdk ? s.replace(/^aws[-_]/, '') : s));
  return [root, ...segments].join('::');
}

/**
 * Recursively resolves the fully-qualified Ruby name of a TS module, class, or type.
 * Inspects the associated JSII assembly target metadata for explicit module configuration
 * (e.g. `ruby.module`) and package-specific acronyms to output accurate namespaces.
 */
function findRubyName(jsiiSymbol: JsiiSymbol): string | undefined {
  if (!jsiiSymbol.sourceAssembly?.assembly) {
    // Don't have accurate info, just guess from the FQN
    return jsiiSymbol.symbolType !== 'module' ? simpleName(jsiiSymbol.fqn) : guessRubyModuleName(jsiiSymbol.fqn);
  }

  const asm = jsiiSymbol.sourceAssembly.assembly;

  // Collect acronyms from the assembly targets
  const acronyms: string[] = asm.targets?.ruby?.acronyms ?? [];

  return recurse(jsiiSymbol.fqn);

  function recurse(fqn: string): string {
    const baseFqn = fqn.split('#')[0];
    if (baseFqn === asm.name) {
      return jsiiTargetParameter(asm, 'ruby.module') ?? rubyModuleName(baseFqn, acronyms);
    }
    if (asm.submodules?.[baseFqn]) {
      const modName = jsiiTargetParameter(asm.submodules[baseFqn], 'ruby.module');
      if (modName) {
        return modName;
      }
    }

    const ns = namespaceName(baseFqn);
    const nsRubyName = recurse(ns);
    const leaf = simpleName(baseFqn);
    return `${nsRubyName}::${rubyModuleName(leaf, acronyms)}`;
  }
}

/**
 * Maps common JavaScript/TypeScript builtin functions to their native Ruby equivalents.
 */
const BUILTIN_FUNCTIONS: { [key: string]: string } = {
  'console.log': 'puts',
  'console.error': 'STDERR.puts',
  'Math.random': 'rand',
};

// Unlike Python (which requires complex state variables to handle struct parameter/argument explosion,
// keyword argument rendering, key-mangling suppression, and parent method name resolution), Ruby's syntax
// maps closely to TypeScript's behavioral forms (like hashes and blocks) without structural rewriting.
// Therefore, the Ruby context only needs to track class boundaries and type expressions.
interface RubyLanguageContext {
  inClass?: boolean;
  inTypeExpression?: boolean;
}
type RubyVisitorContext = AstRenderer<RubyLanguageContext>;

export class RubyVisitor extends DefaultVisitor<RubyLanguageContext> {
  public static readonly VERSION = '1';

  public readonly language = TargetLanguage.RUBY;
  public readonly defaultContext = {};
  protected override statementTerminator = '';

  /**
   * `require` statements already emitted for the source file currently being rendered.
   *
   * Distinct import statements can resolve to the same gem (e.g. two submodule imports
   * of `aws-cdk-lib`), and repeating the `require` would be noise in the translation.
   * Reset per source file (in `sourceFile`) because a single visitor instance may render
   * multiple snippets (e.g. `translateMarkdown` reuses one visitor for a whole document).
   */
  private readonly emittedRequires = new Set<string>();

  public constructor() {
    super();
  }

  public mergeContext(old: RubyLanguageContext, update: Partial<RubyLanguageContext>) {
    return Object.assign({}, old, update);
  }

  public override sourceFile(node: ts.SourceFile, context: RubyVisitorContext): OTree {
    this.emittedRequires.clear();
    return super.sourceFile(node, context);
  }

  /**
   * Translates TypeScript import statements to Ruby `require` or `require_relative` statements.
   * Maps relative paths to `require_relative` and package dependencies to `require` with scoped
   * names converted to standard gem naming format (e.g. @scope/pkg -> scope-pkg).
   */
  public override importStatement(node: ImportStatement, _context: RubyVisitorContext): OTree {
    if (node.packageName.startsWith('.')) {
      return this.renderRequire(`require_relative '${node.packageName}'`);
    }
    // The specifier may address a submodule (e.g. `aws-cdk-lib/aws-s3tables`), but the
    // gem is the npm *package* — the submodule is autoloaded from it, there is no
    // per-submodule require. Keep the package name only: two segments for a scoped
    // package (`@scope/name`), one otherwise. So `aws-cdk-lib/aws-s3tables` -> the
    // `aws-cdk-lib` gem, not the non-existent `aws-cdk-lib-aws-s3tables`.
    const parts = node.packageName.split('/');
    const pkg = node.packageName.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const gemName = pkg.replace(/^@/, '').replace(/\//g, '-');
    return this.renderRequire(`require '${gemName}'`);
  }

  /**
   * Renders a `require`/`require_relative` line, deduplicating repeats within a source file.
   *
   * A duplicate renders as an empty OTree *without* `canBreakLine`: the renderer only
   * attaches leading trivia (the preceding newline) to trees that can break the line,
   * so the duplicate disappears without leaving a blank line behind.
   */
  private renderRequire(requireLine: string): OTree {
    if (this.emittedRequires.has(requireLine)) {
      return new OTree([]);
    }
    this.emittedRequires.add(requireLine);
    return new OTree([requireLine], [], { canBreakLine: true });
  }

  /**
   * Translates variable declarations (e.g. `const x = ...` or `let y: string[]`) to Ruby.
   * Since Ruby is dynamically typed, we initialize variables with their initial value,
   * or fallback to `[]`, `{}`, or `nil` based on the TypeScript type annotation.
   */
  public override variableDeclaration(node: ts.VariableDeclaration, context: RubyVisitorContext): OTree {
    if (node.initializer) {
      return new OTree([context.convert(node.name), ' = ', context.convert(node.initializer)]);
    }
    if (node.type && ts.isArrayTypeNode(node.type)) {
      return new OTree([context.convert(node.name), ' = []']);
    }
    if (node.type && ts.isTypeLiteralNode(node.type)) {
      return new OTree([context.convert(node.name), ' = {}']);
    }
    // An uninitialised declaration (`declare const bucket: s3.IBucket`) is a "given" —
    // something the reader supplies. Ruby has no type annotations, so keep the type as a
    // trailing comment, e.g. `bucket = nil # AWSCDK::S3::IBucket`, instead of dropping it.
    if (node.type && ts.isTypeReferenceNode(node.type)) {
      const sym = lookupJsiiSymbolFromNode(context.typeChecker, node.type.typeName);
      const rubyName = sym ? findRubyName(sym) : undefined;
      if (rubyName) {
        return new OTree([context.convert(node.name), ` = nil # ${rubyName}`]);
      }
    }
    return new OTree([context.convert(node.name), ' = nil']);
  }

  /**
   * Translates a list of variable declarations (e.g. in multi-variable definitions)
   * into newline-separated Ruby variable assignments.
   */
  public override variableDeclarationList(node: ts.VariableDeclarationList, context: RubyVisitorContext): OTree {
    return new OTree(context.convertAll(node.declarations), [], { separator: '\n' });
  }

  public get name() {
    return 'Ruby';
  }

  /**
   * Translates TypeScript comments (single-line and multi-line) into Ruby hash comments (`#`).
   * Strips out specific TS-only directives like `@import`, and formats `@param` tags
   * into YARD-style documentation (e.g. `@param name [RubyType]`).
   */
  public override commentRange(comment: CommentSyntax, _context: RubyVisitorContext): OTree {
    const commentText = stripCommentMarkers(comment.text, comment.kind === ts.SyntaxKind.MultiLineCommentTrivia);
    const lines = commentText.split('\n');
    const filteredLines = lines.filter((l) => !l.trim().startsWith('@import'));

    if (filteredLines.length === 0 || (filteredLines.length === 1 && filteredLines[0].trim() === '')) {
      return new OTree([]);
    }

    const hashLines = filteredLines
      .map((l) => {
        let text = l;
        if (text.includes('@param')) {
          text = text.replace(/@param\s+\{([^}]+)\}\s+(\w+)/g, (_, type, name) => {
            const rubyType = type
              .split('.')
              .map((p: string) => rubyModuleName(p))
              .join('::');
            return `@param ${name} [${rubyType}]`;
          });
        }
        return `# ${text}`.trimEnd();
      })
      .join('\n');

    const needsAdditionalTrailer = comment.hasTrailingNewLine;

    return new OTree([comment.isTrailing ? ' ' : '', hashLines, needsAdditionalTrailer ? '\n' : ''], [], {
      // Make sure comment is rendered exactly once in the output tree, no
      // matter how many source nodes it is attached to.
      renderOnce: `comment-${comment.pos}`,
    });
  }

  /**
   * Translates TypeScript void expressions (such as `void ...` placeholders in test snippets)
   * into Ruby comment placeholders (`# ...`) or standard ellipsis (`...`).
   */
  public override maskingVoidExpression(node: ts.VoidExpression, _context: RubyVisitorContext): OTree {
    const arg = voidExpressionString(node);
    if (arg === 'block') {
      return new OTree(['# ...'], [], { canBreakLine: true });
    }
    if (arg === '...') {
      return new OTree(['...']);
    }
    return NO_SYNTAX;
  }

  /**
   * Translates property access expressions (e.g., `obj.prop` or `Namespace.Constant`).
   * Handles mappings for builtin functions, enum variant accesses, submodule namespace navigation
   * using `::`, class instantiations, `this` property mapping to instance variables (`@name`),
   * and conversion of struct property access to hash lookups (`obj[:prop]`).
   */
  public override propertyAccessExpression(
    node: ts.PropertyAccessExpression,
    context: RubyVisitorContext,
    submoduleReference: SubmoduleReference | undefined,
  ): OTree {
    const fullText = context.textOf(node);
    if (fullText in BUILTIN_FUNCTIONS) {
      return new OTree([BUILTIN_FUNCTIONS[fullText]]);
    }

    if (isEnumAccess(context.typeChecker, node)) {
      return new OTree([context.convert(node.expression), '::', toSnakeCase(node.name.text).toUpperCase()]);
    }

    // Static readonly (const) property access — the "enum-like class" pattern
    // (`BlockPublicAccess.BLOCK_ALL`, `Runtime.RUBY_4_0`). Unlike enum members
    // (`::`), pacmak exposes these as class methods accessed with `.`, and the
    // member keeps its constant casing (matching pacmak's `rubyConstName`).
    // Without this, the access falls into the type-reference branch below and the
    // member is dropped, leaving just `AWSCDK::S3::BlockPublicAccess`.
    if (isStaticReadonlyAccess(context.typeChecker, node)) {
      return new OTree([context.convert(node.expression), '.', toSnakeCase(node.name.text).toUpperCase()]);
    }

    const nameText = node.name.text;
    const isPascalCase = /^[A-Z]/.test(nameText);
    const inTypeExpr = context.currentContext.inTypeExpression || isPascalCase;

    if (submoduleReference != null || inTypeExpr) {
      const jsiiSym = lookupJsiiSymbolFromNode(context.typeChecker, node);
      if (jsiiSym) {
        const rubyName = findRubyName(jsiiSym);
        if (rubyName) {
          return new OTree([rubyName]);
        }
      }

      let exprNode = context.updateContext({ inTypeExpression: inTypeExpr }).convert(node.expression);
      if (inTypeExpr && ts.isIdentifier(node.expression)) {
        exprNode = new OTree([rubyModuleName(context.textOf(node.expression))]);
      }

      let nameNode = context.convert(node.name);
      if (inTypeExpr) {
        nameNode = new OTree([rubyModuleName(nameText)]);
      }

      return new OTree([exprNode, '::', nameNode]);
    }

    if (context.textOf(node.expression) === 'this') {
      // `this.member` maps to the instance variable `@member` for field reads and
      // writes alike — this is robust even for private fields that have no accessor.
      // Method invocations (`this.method(...)`) are the exception: they fall through
      // to the `self.method` call form rendered below.
      const isMethodCall = ts.isCallExpression(node.parent) && node.parent.expression === node;
      if (!isMethodCall) {
        return new OTree(['@', toSnakeCase(node.name.text)]);
      }
    }

    const exprType = context.typeOfExpression(node.expression);
    if (exprType && analyzeStructType(context.typeChecker, exprType) !== false) {
      return new OTree([context.convert(node.expression), '[:', toSnakeCase(node.name.text), ']']);
    }

    // Preserve optional chaining (`a?.b`) using Ruby's safe-navigation operator (`a&.b`).
    const accessor = node.questionDotToken ? '&.' : '.';
    return new OTree([context.convert(node.expression), accessor, toSnakeCase(node.name.text)]);
  }

  /**
   * Translates binary expressions, mapping TypeScript operators that have no
   * direct Ruby equivalent. Strict (in)equality (`===`/`!==`) collapse to Ruby's
   * `==`/`!=`, and nullish coalescing (`??`) becomes `||`. Unlike the default
   * visitor we do not report `??` as unsupported, since we render it faithfully.
   */
  public override binaryExpression(node: ts.BinaryExpression, context: RubyVisitorContext): OTree {
    // `a instanceof B` has no operator form in Ruby; use the `is_a?` predicate.
    if (node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
      return new OTree([context.convert(node.left), '.is_a?(', context.convert(node.right), ')']);
    }
    const operator = this.translateBinaryOperator(context.textOf(node.operatorToken));
    return new OTree([context.convert(node.left), ' ', operator, ' ', context.convert(node.right)]);
  }

  public override translateBinaryOperator(operator: string) {
    switch (operator) {
      case '===':
        return '==';
      case '!==':
        return '!=';
      case '??':
        return '||';
      case '??=':
        return '||=';
      default:
        return operator;
    }
  }

  /**
   * Translates prefix unary expressions. Ruby has no `++`/`--` operators, so we
   * rewrite them to the equivalent compound assignment (`i += 1` / `i -= 1`);
   * all other unary operators (`-`, `!`, `~`, `+`) pass through unchanged.
   */
  public override prefixUnaryExpression(node: ts.PrefixUnaryExpression, context: RubyVisitorContext): OTree {
    if (node.operator === ts.SyntaxKind.PlusPlusToken) {
      return new OTree([context.convert(node.operand), ' += 1']);
    }
    if (node.operator === ts.SyntaxKind.MinusMinusToken) {
      return new OTree([context.convert(node.operand), ' -= 1']);
    }
    return super.prefixUnaryExpression(node, context);
  }

  /**
   * Translates postfix unary expressions (`i++` / `i--`) to the equivalent Ruby
   * compound assignment (`i += 1` / `i -= 1`). The pre/post distinction is not
   * preserved, which is correct in statement position (the common case in
   * examples) and only lossy in the rare event the value is used inline.
   */
  public override postfixUnaryExpression(node: ts.PostfixUnaryExpression, context: RubyVisitorContext): OTree {
    const op = node.operator === ts.SyntaxKind.PlusPlusToken ? ' += 1' : ' -= 1';
    return new OTree([context.convert(node.operand), op]);
  }

  /**
   * Translates a ternary (`cond ? a : b`). Ruby's conditional expression uses the
   * identical syntax, so this is a direct rendering.
   */
  public override conditionalExpression(node: ts.ConditionalExpression, context: RubyVisitorContext): OTree {
    return new OTree([
      context.convert(node.condition),
      ' ? ',
      context.convert(node.whenTrue),
      ' : ',
      context.convert(node.whenFalse),
    ]);
  }

  /**
   * Translates TypeScript type assertions (`expr as Type`) to Ruby. A TS `as` cast is a
   * compile-time assertion with no runtime effect, so the expression passes through unchanged
   * (matching the Python/Java visitors). We deliberately do NOT emit `.to_i`/`.to_s`, which
   * would be actual runtime conversions and change semantics.
   */
  public override asExpression(node: ts.AsExpression, context: RubyVisitorContext): OTree {
    return context.convert(node.expression);
  }

  /**
   * Translates call expressions (method and function invocations) to Ruby.
   * Formats arguments separated by commas, wrapped in parentheses if arguments exist.
   */
  public override callExpression(node: ts.CallExpression, context: RubyVisitorContext): OTree {
    const args =
      node.arguments.length > 0
        ? new OTree(['('], context.convertAll(node.arguments), { separator: ', ', suffix: ')' })
        : // A bare `super` in Ruby forwards ALL of the enclosing method's arguments, whereas
        // TypeScript `super()` calls with none. Emit explicit empty parens to preserve that.
        node.expression.kind === ts.SyntaxKind.SuperKeyword
        ? new OTree(['()'])
        : new OTree([]);
    return new OTree([context.convert(node.expression), args]);
  }

  /**
   * Translates identifiers (variable, function, parameter names).
   * Converts local/method names to snake_case, checks reserved keywords, and resolves
   * fully-qualified Ruby names for known type/class symbols using JSII metadata.
   */
  public override identifier(node: ts.Identifier, context: RubyVisitorContext): OTree {
    const text = node.text;
    // `undefined` is a global identifier in TS/JS (not a keyword); map it to Ruby's `nil`.
    if (text === 'undefined') {
      return new OTree(['nil']);
    }
    if (text.match(/^[_a-z]/)) {
      return new OTree([toSnakeCase(text)]);
    }

    const jsiiSym = lookupJsiiSymbolFromNode(context.typeChecker, node);
    if (jsiiSym) {
      const rubyName = findRubyName(jsiiSym);
      if (rubyName) {
        return new OTree([rubyName]);
      }
    }

    return new OTree([text]);
  }

  /**
   * Translates `new ClassName(...)` instantiations to Ruby `ClassName.new(...)`.
   */
  public override newExpression(node: ts.NewExpression, context: RubyVisitorContext): OTree {
    const args =
      node.arguments && node.arguments.length > 0
        ? new OTree(['('], context.convertAll(node.arguments), { separator: ', ', suffix: ')' })
        : new OTree([]);
    return new OTree([context.convert(node.expression), '.new', args], [], { canBreakLine: true });
  }

  /**
   * Dispatches object literals to the appropriate Hash renderer.
   *
   * This mirrors the default visitor's reporting, with one deliberate exception:
   * object spreads (`...expr`) are NOT reported as unsupported, because Ruby
   * renders them faithfully as `**expr` (see `spreadAssignment`). Other
   * non-standard members (methods, getters/setters) are still reported, since we
   * cannot translate those to valid Ruby.
   */
  public override objectLiteralExpression(node: ts.ObjectLiteralExpression, context: RubyVisitorContext): OTree {
    const unsupported = node.properties.filter(
      (p) => !ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p) && !ts.isSpreadAssignment(p),
    );
    for (const unsup of unsupported) {
      context.report(unsup, `Use of ${ts.SyntaxKind[unsup.kind]} in an object literal is not supported.`);
    }

    const anyMembersFunctions = node.properties.some((p) =>
      ts.isPropertyAssignment(p)
        ? isExpressionOfFunctionType(context.typeChecker, p.initializer)
        : ts.isShorthandPropertyAssignment(p)
        ? isExpressionOfFunctionType(context.typeChecker, p.name)
        : false,
    );

    const inferredType = inferredTypeOfExpression(context.typeChecker, node);
    if ((inferredType && isJsiiProtocolType(context.typeChecker, inferredType)) || anyMembersFunctions) {
      context.report(
        node,
        `You cannot use an object literal to make an instance of an interface. Define a class instead.`,
      );
    }

    const lit = analyzeObjectLiteral(context.typeChecker, node);

    switch (lit.kind) {
      case 'unknown':
        return this.unknownTypeObjectLiteralExpression(node, context);
      case 'struct':
      case 'local-struct':
        return this.knownStructObjectLiteralExpression(node, lit, context);
      case 'map':
        return this.keyValueObjectLiteralExpression(node, context);
    }
  }

  /**
   * Translates object literals with unknown types to Ruby Hash literals.
   */
  public override unknownTypeObjectLiteralExpression(
    node: ts.ObjectLiteralExpression,
    context: RubyVisitorContext,
  ): OTree {
    return this.renderObjectLiteralExpression(node, context);
  }

  /**
   * Translates object literals matching a known JSII struct type to Ruby Hash literals.
   */
  public override knownStructObjectLiteralExpression(
    node: ts.ObjectLiteralExpression,
    _structType: ObjectLiteralStruct,
    context: RubyVisitorContext,
  ): OTree {
    return this.renderObjectLiteralExpression(node, context);
  }

  /**
   * Translates key-value object literals to Ruby Hash literals.
   */
  public override keyValueObjectLiteralExpression(
    node: ts.ObjectLiteralExpression,
    context: RubyVisitorContext,
  ): OTree {
    return this.renderObjectLiteralExpression(node, context);
  }

  /**
   * Helper that renders a TypeScript object literal expression as a Ruby Hash literal.
   * Properly indents multi-line hashes and formats empty hashes as `{}`.
   */
  private renderObjectLiteralExpression(node: ts.ObjectLiteralExpression, context: RubyVisitorContext): OTree {
    if (node.properties.length === 0) return new OTree(['{}']);
    // Same normalisation as arrays: a multi-line hash puts every property on its own
    // line, so a property following a multi-line value (e.g. `bucket:` after a broken
    // `InputFormat.csv({...})`) no longer gets stranded on the value's closing line.
    const multiline = context.textOf(node).includes('\n');
    return new OTree(['{'], context.convertAll(node.properties), {
      suffix: '}',
      separator: multiline ? ',' : ', ',
      trailingSeparator: multiline,
      indent: 4,
    });
  }

  /**
   * Translates object property assignments.
   * Uses rocket syntax (`key => value`) for string/computed keys and symbol colon syntax (`key: value`)
   * for standard identifiers.
   */
  public override propertyAssignment(node: ts.PropertyAssignment, context: RubyVisitorContext): OTree {
    if (ts.isStringLiteral(node.name) || ts.isComputedPropertyName(node.name)) {
      return new OTree([context.convert(node.name), ' => ', context.convert(node.initializer)], [], {
        canBreakLine: true,
      });
    } else {
      return new OTree([context.convert(node.name), ': ', context.convert(node.initializer)], [], {
        canBreakLine: true,
      });
    }
  }

  /**
   * Translates shorthand property assignments (e.g. `{ prop }`) to Ruby syntax (`prop: prop`).
   */
  public override shorthandPropertyAssignment(
    node: ts.ShorthandPropertyAssignment,
    context: RubyVisitorContext,
  ): OTree {
    return new OTree([toSnakeCase(node.name.text), ': ', context.convert(node.name)]);
  }

  /**
   * Translates TypeScript array literals (`[...]`) to Ruby array literals.
   */
  public override arrayLiteralExpression(node: ts.ArrayLiteralExpression, context: RubyVisitorContext): OTree {
    if (node.elements.length === 0) return new OTree(['[]']);
    // Normalise the layout instead of mirroring the source's line breaks faithfully:
    // if the literal spans multiple lines, put *every* element on its own line (and the
    // `]` on its own line). Otherwise keep it inline. Mirroring produced inconsistent
    // output — elements sharing a line while `]` dropped to a line of its own.
    const multiline = context.textOf(node).includes('\n');
    return new OTree(['['], context.convertAll(node.elements), {
      suffix: ']',
      separator: multiline ? ',' : ', ',
      trailingSeparator: multiline,
      indent: 4,
    });
  }

  /**
   * Translates an array/argument spread (`...arr`) to Ruby's splat operator (`*arr`).
   */
  public override spreadElement(node: ts.SpreadElement, context: RubyVisitorContext): OTree {
    return new OTree(['*', context.convert(node.expression)]);
  }

  /**
   * Translates an object spread (`{ ...opts }`) to Ruby's double-splat operator (`**opts`).
   */
  public override spreadAssignment(node: ts.SpreadAssignment, context: RubyVisitorContext): OTree {
    return new OTree(['**', context.convert(node.expression)]);
  }

  /**
   * Translates class method declarations to Ruby method definitions (`def ... end`).
   */
  public override methodDeclaration(node: ts.MethodDeclaration, context: RubyVisitorContext): OTree {
    return this.functionLike(node, context);
  }

  /**
   * Translates top-level function declarations to Ruby method definitions.
   */
  public override functionDeclaration(node: ts.FunctionDeclaration, context: RubyVisitorContext): OTree {
    return this.functionLike(node, context);
  }

  /**
   * Translates constructor declarations to the Ruby initializer method (`def initialize ... end`).
   */
  public override constructorDeclaration(node: ts.ConstructorDeclaration, context: RubyVisitorContext): OTree {
    return this.functionLike(node, context, { isConstructor: true });
  }

  /**
   * Common helper for translating methods, functions, and constructors.
   * Maps parameters and formats the block body with correct indentation and Ruby `def`/`end` boundaries.
   */
  public functionLike(
    node: ts.FunctionLikeDeclarationBase | ts.MethodSignature,
    context: RubyVisitorContext,
    opts: { isConstructor?: boolean } = {},
  ): OTree {
    const isStatic =
      !opts.isConstructor &&
      ((node as ts.MethodDeclaration).modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false);
    const baseName = node.name ? toSnakeCase(context.textOf(node.name)) : 'anonymous';
    const methodName = opts.isConstructor ? 'initialize' : isStatic ? `self.${baseName}` : baseName;
    const paramDecls = context.convertAll(node.parameters);

    const signature = paramDecls.length > 0 ? ['(', new OTree([], paramDecls, { separator: ', ' }), ')'] : [];

    const bodyNode = (node as any).body;
    const bodyChildren = bodyNode ? [context.convert(bodyNode)] : [];

    return new OTree(['def ', methodName, ...signature], bodyChildren, {
      canBreakLine: true,
      suffix: '\nend',
    });
  }

  /**
   * Translates parameter declarations in function/method signatures.
   * Handles default initializers, rest parameters (`*args`), and nullable parameters
   * initialized to `nil`.
   */
  public override parameterDeclaration(node: ts.ParameterDeclaration, context: RubyVisitorContext): OTree {
    const name = toSnakeCase(context.textOf(node.name));
    const prefix = node.dotDotDotToken ? '*' : '';
    if (node.initializer) {
      return new OTree([prefix, name, ' = ', context.convert(node.initializer)]);
    }

    const type = node.type && context.typeOfType(node.type);
    if (parameterAcceptsUndefined(node, type)) {
      return new OTree([prefix, name, ' = nil']);
    }
    return new OTree([prefix, name]);
  }

  /**
   * Translates syntax tokens. Maps TypeScript `this` keywords to Ruby `self`.
   */
  public override token<A extends ts.SyntaxKind>(node: ts.Token<A>, context: RubyVisitorContext): OTree {
    const text = context.textOf(node);
    if (text === 'this') {
      return new OTree(['self']);
    }
    if (text === 'null') {
      return new OTree(['nil']);
    }
    return super.token(node, context);
  }

  /**
   * Translates TypeScript class declarations to Ruby classes.
   * Handles single inheritance (`< ParentClass`), maps interface implementations to module includes
   * (`include InterfaceModule`), and converts class members.
   */
  public override classDeclaration(node: ts.ClassDeclaration, context: RubyVisitorContext): OTree {
    // Separate extends from implements
    const extendsClauses: ts.ExpressionWithTypeArguments[] = [];
    const implementsClauses: ts.ExpressionWithTypeArguments[] = [];
    for (const clause of node.heritageClauses ?? []) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        extendsClauses.push(...clause.types);
      } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        implementsClauses.push(...clause.types);
      }
    }

    const extendsExpr =
      extendsClauses.length > 0
        ? context.updateContext({ inTypeExpression: true }).convert(extendsClauses[0].expression)
        : undefined;

    // In Ruby, implements becomes `include ModuleName`
    const includes = implementsClauses.map(
      (t) => new OTree(['\ninclude ', context.updateContext({ inTypeExpression: true }).convert(t.expression)]),
    );

    const members = context.updateContext({ inClass: true }).convertAll(node.members);

    return new OTree(
      [
        'class ',
        node.name ? toPascalCase(context.textOf(node.name)) : '???',
        extendsExpr ? ' < ' : '',
        ...(extendsExpr ? [extendsExpr] : []),
      ],
      [...includes, ...members],
      {
        indent: 2,
        canBreakLine: true,
        suffix: '\nend',
      },
    );
  }

  /**
   * Translates TypeScript property declarations to Ruby attribute macros.
   * Maps read-only properties to `attr_reader`, read-write to `attr_accessor`, and private fields
   * using the `private` keyword prefix.
   */
  public override propertyDeclaration(node: ts.PropertyDeclaration, context: RubyVisitorContext): OTree {
    const isStatic = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    const isPrivate = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ?? false;
    const isReadonly = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false;

    // A `static` field is a class-level value; render it as a Ruby constant (`NAME = value`),
    // preserving its initializer, rather than an instance attribute macro. Ruby constants must
    // begin with an uppercase letter.
    if (isStatic) {
      const rawName = node.name.getText();
      const constName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const value = node.initializer ? context.convert(node.initializer) : new OTree(['nil']);
      return new OTree([`${constName} = `, value], [], { canBreakLine: true });
    }

    const attrMethod = isReadonly ? 'attr_reader' : 'attr_accessor';
    const attrName = toSnakeCase(node.name.getText());
    const attrLine = `${attrMethod} :${attrName}`;

    if (isPrivate) {
      return new OTree([`private ${attrLine}`], [], { canBreakLine: true });
    }
    return new OTree([attrLine], [], { canBreakLine: true });
  }

  /**
   * Translates TypeScript behavioral interface declarations to Ruby modules containing the member definitions.
   */
  public override regularInterfaceDeclaration(node: ts.InterfaceDeclaration, context: RubyVisitorContext): OTree {
    const members = context.updateContext({ inClass: true }).convertAll(node.members);
    return new OTree(['module ', node.name ? toPascalCase(context.textOf(node.name)) : '???'], members, {
      indent: 2,
      canBreakLine: true,
      suffix: '\nend',
    });
  }

  /**
   * Translates TypeScript data-only struct interfaces.
   * In Ruby, structs are represented as plain Hash objects, so we skip module generation.
   */
  public override structInterfaceDeclaration(_node: ts.InterfaceDeclaration, _context: RubyVisitorContext): OTree {
    // In ruby, structs are just Hashes. Skip generation.
    return new OTree([]);
  }

  /**
   * Translates method signatures inside interfaces to Ruby method definitions.
   */
  public override methodSignature(node: ts.MethodSignature, context: RubyVisitorContext): OTree {
    return this.functionLike(node, context);
  }

  /**
   * Translates property signatures inside interfaces to Ruby attribute macros.
   */
  public override propertySignature(node: ts.PropertySignature, context: RubyVisitorContext): OTree {
    return this.propertyDeclaration(node as unknown as ts.PropertyDeclaration, context);
  }

  /**
   * Translates template expressions (string interpolation) to double-quoted Ruby strings with `#{}` blocks.
   */
  public override templateExpression(node: ts.TemplateExpression, context: RubyVisitorContext): OTree {
    const elements = [new OTree(['"', escapeRubyTemplateText(node.head.text)])];
    for (const span of node.templateSpans) {
      elements.push(new OTree(['#{', context.convert(span.expression), '}', escapeRubyTemplateText(span.literal.text)]));
    }
    elements.push(new OTree(['"']));
    return new OTree(elements);
  }

  /**
   * Translates non-interpolated template literals to Ruby string literals.
   */
  public noSubstitutionTemplateLiteral(node: ts.NoSubstitutionTemplateLiteral, _context: RubyVisitorContext): OTree {
    return this.renderStringLiteral(node);
  }

  /**
   * Translates standard TypeScript string literals to Ruby.
   */
  public override stringLiteral(node: ts.StringLiteral, _context: RubyVisitorContext): OTree {
    return this.renderStringLiteral(node);
  }

  /**
   * Helper that renders string literals. Handles multi-line strings by translating them
   * into Ruby heredoc syntax (`<<-'HERE'...HERE`) with safe unique delimiters, and single-line strings
   * using standard JSON-serialized double-quotes.
   */
  private renderStringLiteral(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): OTree {
    if (node.text.includes('\n')) {
      const marker = 'HERE';
      let safeMarker = marker;
      let i = 0;
      while (node.text.includes(`\n${safeMarker}\n`) || node.text.endsWith(`\n${safeMarker}`)) {
        safeMarker = `${marker}${i++}`;
      }
      return new OTree([`<<-'${safeMarker}'\n`, node.text, `\n${safeMarker}`]);
    }
    return new OTree([`"${rubyDoubleQuotedInner(node.text)}"`]);
  }

  /**
   * Translates block statements to indented Ruby statements, omitting curly braces.
   */
  public override block(node: ts.Block, context: RubyVisitorContext): OTree {
    if (node.statements.length === 0) {
      return new OTree([]);
    }
    return new OTree([], context.convertAll(node.statements), {
      separator: '',
      indent: 2,
    });
  }

  /**
   * Translates arrow functions to Ruby lambdas: `(bell) => bell.ring()`
   * becomes `->(bell) { bell.ring }`, and a block body becomes a multi-line
   * lambda. Runnable output — the runtime coerces Procs into single-method
   * interface implementations at jsii call sites, so a rendered lambda is a
   * working callback, not just a visual approximation.
   */
  public override arrowFunction(node: ts.ArrowFunction, context: RubyVisitorContext): OTree {
    return this.renderLambda(node, node.body, context);
  }

  /** Translates `function (a) { ... }` expressions exactly like arrows. */
  public override functionExpression(node: ts.FunctionExpression, context: RubyVisitorContext): OTree {
    return this.renderLambda(node, node.body, context);
  }

  private renderLambda(
    node: ts.ArrowFunction | ts.FunctionExpression,
    body: ts.ConciseBody,
    context: RubyVisitorContext,
  ): OTree {
    // Only simple identifier parameters translate cleanly; destructuring,
    // defaults and rest parameters fall back to the shared unsupported path
    // (diagnostic + raw source text), same as any untranslatable node.
    const simple = node.parameters.every(
      (p) => ts.isIdentifier(p.name) && p.initializer == null && p.dotDotDotToken == null,
    );
    if (!simple) {
      return context.renderUnsupported(node, TargetLanguage.RUBY);
    }

    const params = node.parameters.map((p) => toSnakeCase((p.name as ts.Identifier).text));
    const head = params.length > 0 ? `->(${params.join(', ')}) ` : '-> ';

    if (ts.isBlock(body)) {
      return new OTree([head, '{'], [context.convert(body)], {
        canBreakLine: true,
        suffix: '\n}',
      });
    }
    return new OTree([head, '{ ', context.convert(body), ' }']);
  }

  /**
   * Translates `if-else` statements to Ruby syntax.
   * Handles inline suffix `if` for single statements, `elsif` for else-if chains, and standard `if/else/end` blocks.
   */
  public override ifStatement(node: ts.IfStatement, context: RubyVisitorContext): OTree {
    const isThenBlock = ts.isBlock(node.thenStatement);
    if (!node.elseStatement && !isThenBlock) {
      return new OTree([context.convert(node.thenStatement), ' if ', context.convert(node.expression)]);
    }

    const renderBody = (stmt: ts.Statement): OTree =>
      ts.isBlock(stmt)
        ? context.convert(stmt)
        : new OTree([], ['\n', context.convert(stmt)], { indent: 2 });

    // Build the `if` / `elsif` / `else` chain iteratively so exactly one `end` is emitted.
    // Recursively converting a nested `else if` would append that nested `if`'s own `end`,
    // producing a doubled `end` and invalid Ruby.
    const parts: Array<OTree | string> = [
      new OTree(['if ', context.convert(node.expression)], [renderBody(node.thenStatement)], { canBreakLine: true }),
    ];

    let current: ts.IfStatement = node;
    while (current.elseStatement && ts.isIfStatement(current.elseStatement)) {
      const elseIf: ts.IfStatement = current.elseStatement;
      parts.push(
        new OTree(['\nelsif ', context.convert(elseIf.expression)], [renderBody(elseIf.thenStatement)], {
          canBreakLine: true,
        }),
      );
      current = elseIf;
    }

    if (current.elseStatement) {
      parts.push(new OTree(['\nelse'], [renderBody(current.elseStatement)], { canBreakLine: true }));
    }

    parts.push('\nend');
    return new OTree([], parts, { separator: '', canBreakLine: true });
  }

  /**
   * Translates `for (const x of array)` loop statements to Ruby `.each` loops.
   * Formats as single-line curly braces `{ |x| ... }` or multi-line `do |x| ... end` blocks.
   */
  public override forOfStatement(node: ts.ForOfStatement, context: RubyVisitorContext): OTree {
    let variableName = '???';
    matchAst(
      node.initializer,
      nodeOfType(ts.SyntaxKind.VariableDeclarationList, nodeOfType('var', ts.SyntaxKind.VariableDeclaration)),
      (bindings) => {
        variableName = toSnakeCase(context.textOf(bindings.var.name));
      },
    );

    const isBlock = ts.isBlock(node.statement);
    const statements = isBlock ? (node.statement as ts.Block).statements : [node.statement];
    const isMultiLine = statements.length !== 1 || node.getText().includes('\n');

    if (!isMultiLine) {
      return new OTree([
        context.convert(node.expression),
        `.each { |${variableName}| `,
        context.convert(statements[0]),
        ' }',
      ]);
    } else {
      const body = isBlock
        ? context.convert(node.statement)
        : new OTree([], ['\n', context.convert(node.statement)], { indent: 2 });

      const loopStart = new OTree([context.convert(node.expression), `.each do |${variableName}|`], [body], {
        canBreakLine: true,
      });
      return new OTree([], [loopStart, '\nend'], {
        separator: '',
        canBreakLine: true,
      });
    }
  }
}
