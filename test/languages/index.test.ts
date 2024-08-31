import { PythonVisitor, CSharpVisitor, GoVisitor, JavaVisitor } from '../../lib/';
import { getVisitorFromLanguage } from '../../lib/languages';
import { VisualizeAstVisitor } from '../../lib/languages/visualize';

describe('getVisitorFromLanguage', () => {
  test.each([
    { language: 'python', visitor: PythonVisitor },
    { language: 'java', visitor: JavaVisitor },
    { language: 'go', visitor: GoVisitor },
    { language: 'csharp', visitor: CSharpVisitor },
  ])('should return a specific visitor for a valid language ($language)', ({ language, visitor }) => {
    const result = getVisitorFromLanguage(language);
    expect(result).toBeInstanceOf(visitor);
  });

  test('should throw an error for an unknown language', () => {
    expect(() => getVisitorFromLanguage('unknown')).toThrow(/Unknown target language/);
  });

  test('should return VisualizeAstVisitor for undefined language', () => {
    const result = getVisitorFromLanguage(undefined);
    expect(result).toBeInstanceOf(VisualizeAstVisitor);
  });
});
