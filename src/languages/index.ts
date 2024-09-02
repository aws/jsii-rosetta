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

export function getVisitorFromLanguage(language: string | undefined) {
  if (language !== undefined) {
    const target = Object.values(TargetLanguage).find((t) => t === language);
    if (target === undefined) {
      throw new Error(
        `Unknown target language: ${language}. Expected one of ${Object.values(TargetLanguage).join(', ')}`,
      );
    }
    return TARGET_LANGUAGES[target].createVisitor();
  }
  // Default to visualizing AST, including nodes we don't recognize yet
  return new VisualizeAstVisitor();
}
