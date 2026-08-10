import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DefaultVisitor } from '../lib/languages/default';
import { registerTargetLanguage, TargetLanguage } from '../lib/languages';
import { OTree } from '../lib/o-tree';
import { RosettaTranslator } from '../lib/rosetta-translator';
import { typeScriptSnippetFromVisibleSource } from '../lib/snippet';
import { testSnippetLocation } from './testutil';

const location = testSnippetLocation('cache-missing-language');

/** A language registered *after* the cache was built. */
class LatecomerVisitor extends DefaultVisitor<object> {
  public readonly language = 'latecomer' as TargetLanguage;
  public readonly defaultContext = {};
  public mergeContext(old: object, update: object) {
    return { ...old, ...update };
  }
  public identifier(node: any): OTree {
    return new OTree([`«${String(node.text)}»`]);
  }
}

// Every library ships a tablet translated for the languages that existed when
// it was published. A newly registered language is in none of them, and the
// cache check only compared the BUILT-IN language map — so every cached
// snippet looked clean, was skipped, and was copied to the output with no
// translation for the new language. Extracting aws-cdk-lib then "succeeded"
// in seconds and produced a tablet with 37 translations out of 21,394.
describe('a cached snippet missing a registered language', () => {
  test('is not treated as a cache hit', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'rosetta-missing-lang-'));
    try {
      const cacheBuilder = new RosettaTranslator({ includeCompilerDiagnostics: true });
      const snippet = typeScriptSnippetFromVisibleSource('const value = 1;', location, true);
      await cacheBuilder.translateAll([snippet]);
      await cacheBuilder.tablet.save(join(cacheDir, 'cache.tabl.json'));

      registerTargetLanguage('latecomer', {
        version: '1',
        createVisitor: () => new LatecomerVisitor(),
      });

      const translator = new RosettaTranslator({ includeCompilerDiagnostics: true });
      await translator.loadCache(join(cacheDir, 'cache.tabl.json'));
      const cached = translator.readFromCache([snippet]);

      expect(cached.translations).toHaveLength(0);
      expect(cached.remaining).toHaveLength(1);
    } finally {
      await rm(cacheDir, { force: true, recursive: true });
    }
  });
});
