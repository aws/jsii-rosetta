import { DefaultVisitor } from '../lib/languages/default';
import { allTargetLanguages, registerTargetLanguage, TargetLanguage } from '../lib/languages';
import { OTree } from '../lib/o-tree';
import { SnippetTranslator, Translator } from '../lib/translate';
import { typeScriptSnippetFromCompleteSource } from '../lib/snippet';
import { testSnippetLocation } from './testutil';

/**
 * A minimal external language plugin: it renders every identifier in upper
 * case, which is enough to tell its output apart from the TypeScript source.
 */
class ShoutyVisitor extends DefaultVisitor<object> {
  public readonly language = 'shouty' as TargetLanguage;
  public readonly defaultContext = {};
  public mergeContext(old: object, update: object) {
    return { ...old, ...update };
  }
  public identifier(node: any): OTree {
    return new OTree([String(node.text).toUpperCase()]);
  }
}

beforeAll(() => {
  registerTargetLanguage('shouty', {
    version: '1',
    createVisitor: () => new ShoutyVisitor(),
  });
});

describe('an externally registered language', () => {
  test('is included in allTargetLanguages', () => {
    expect(allTargetLanguages()).toContain('shouty');
  });

  test('is translated by Translator.translate without being named explicitly', () => {
    // The default language list has to come from the registry. When it came
    // from the built-in TargetLanguage enum, registering a language was not
    // enough: every plugin language silently fell through as untranslated,
    // and callers (jsii-pacmak targets) got the TypeScript source back.
    const snippet = typeScriptSnippetFromCompleteSource(
      'const foo = 1;',
      testSnippetLocation('external-language'),
      false,
    );
    const translated = new Translator(false).translate(snippet);

    const shouty = translated.get('shouty' as TargetLanguage);
    expect(shouty).toBeDefined();
    expect(shouty!.source).toContain('FOO');
  });

  test('is still translated when the caller names languages explicitly', () => {
    const snippet = typeScriptSnippetFromCompleteSource(
      'const foo = 1;',
      testSnippetLocation('external-language'),
      false,
    );
    const translated = new Translator(false).translate(snippet, ['shouty' as TargetLanguage]);
    expect(translated.get('shouty' as TargetLanguage)?.source).toContain('FOO');
  });

  test('renderUsing still works directly (unchanged behaviour)', () => {
    const snippet = typeScriptSnippetFromCompleteSource(
      'const foo = 1;',
      testSnippetLocation('external-language'),
      false,
    );
    expect(new SnippetTranslator(snippet).renderUsing(new ShoutyVisitor())).toContain('FOO');
  });
});
