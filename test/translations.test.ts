import * as fs from 'node:fs';

import { TARGET_LANGUAGES, TargetLanguage, VisitorFactory } from '../lib/languages';
import {
  normalizeExpectedSource,
  normalizeRenderedSource,
  TranslationsCorpus,
} from '../lib/testing/translations-corpus';

// This iterates through the translations corpus (the `corpus/` directory,
// shipped with the package), and creates a Jest test for each snippet, by
// translating the TypeScript file it finds there, and comparing it to each
// of the language-specific files also present there with the same base name
// (but a different extension, of course).
// To add a new language to the tests,
// add an element to the SUPPORTED_LANGUAGES constant
//
// The corpus enumeration, snippet compilation, and comparison normalization
// all live in lib/testing/translations-corpus — the same published API an
// external language plugin uses to run this corpus against its own visitor.
// This test doubles as that API's proof.
//
// To run only the tests for a certain language you're working on, do this:
//
//    yarn test test/translations.test -t 'Translating .* to Python'
//    yarn test test/translations.test -t 'Translating .* to Java'
//    yarn test test/translations.test -t 'Translating .* to C#'
//    yarn test test/translations.test -t 'Translating .* to Go'
//
// To narrow it down even more you can of course replace the '.*' regex with
// whatever file indication you desire.

interface SupportedLanguage {
  readonly name: string;

  readonly extension: string;

  readonly visitorFactory: VisitorFactory;
}

export const SUPPORTED_LANGUAGES = new Array<SupportedLanguage>(
  {
    name: 'Python',
    extension: '.py',
    visitorFactory: TARGET_LANGUAGES[TargetLanguage.PYTHON],
  },
  {
    name: 'Java',
    extension: '.java',
    visitorFactory: TARGET_LANGUAGES[TargetLanguage.JAVA],
  },
  {
    name: 'C#',
    extension: '.cs',
    visitorFactory: TARGET_LANGUAGES[TargetLanguage.CSHARP],
  },
  {
    name: 'Go',
    extension: '.go',
    visitorFactory: TARGET_LANGUAGES[TargetLanguage.GO],
  },
);

let corpus: TranslationsCorpus;

// Prepare a compilation directory with the right dependencies in...
beforeAll(async () => {
  corpus = await TranslationsCorpus.create();
});

afterAll(async () => {
  if (corpus) {
    await corpus.dispose();
  }
  corpus = undefined as any; // Need this to properly release memory
});

for (const snippetName of TranslationsCorpus.snippetNames()) {
  describe(`Translating ${snippetName}.ts`, () => {
    let anyFailed = false;

    afterAll(() => {
      // Print the AST for tests that failed (to help debugging)
      if (anyFailed && corpus) {
        console.log(`${corpus.visualizeAst(corpus.snippet(snippetName)!)}\n`);
      }
    });

    for (const { name, extension, visitorFactory } of SUPPORTED_LANGUAGES) {
      // Use 'test.skip' if the file doesn't exist so that we can clearly see it's missing.
      const hasExpectation = fs.existsSync(`${TranslationsCorpus.DEFAULT_CORPUS_ROOT}/${snippetName}${extension}`);
      const testConstructor = hasExpectation ? test : test.skip;

      testConstructor(`to ${name}`, () => {
        const snippet = corpus.snippet(snippetName)!;
        try {
          const expected = corpus.expectation(snippet, extension)!;
          const translation = corpus.render(snippet, visitorFactory.createVisitor());
          expect(normalizeRenderedSource(translation)).toBe(normalizeExpectedSource(expected));
        } catch (e) {
          anyFailed = true;
          throw e;
        }
      });
    }
  });
}
