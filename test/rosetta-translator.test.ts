import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as path from 'node:path';
import { withTemporaryDirectory } from './testutil';
import {
  RosettaTranslator,
  typeScriptSnippetFromVisibleSource,
  SnippetLocation,
  TargetLanguage,
  TypeScriptSnippet,
} from '../lib';

const location: SnippetLocation = { api: { api: 'file', fileName: 'test.ts' } };

jest.setTimeout(60_000);

test('translator can translate', async () => {
  const translator = new RosettaTranslator({
    includeCompilerDiagnostics: true,
  });

  const snippet = typeScriptSnippetFromVisibleSource('console.log("hello world");', location, true);

  const { translatedSnippets } = await translator.translateAll([snippet]);

  expect(translatedSnippets).toHaveLength(1);
  expect(translatedSnippets[0].get(TargetLanguage.PYTHON)?.source).toEqual('print("hello world")');

  expect(translator.tablet.snippetKeys).toHaveLength(1);
});

test('translator can read from cache', async () => {
  await withTemporaryDirectory(async () => {
    // GIVEN: prepare cache
    const cacheDir = await mkdtemp(join(tmpdir(), 'rosetta-temp-cache-'));
    try {
      const cacheBuilder = new RosettaTranslator({ includeCompilerDiagnostics: true });
      const snippet = typeScriptSnippetFromVisibleSource('console.log("hello world");', location, true);
      await cacheBuilder.translateAll([snippet]);
      await cacheBuilder.tablet.save(join(cacheDir, 'temp.tabl.json'));

      // WHEN: new translator
      const translator = new RosettaTranslator({ includeCompilerDiagnostics: true });
      await translator.loadCache(join(cacheDir, 'temp.tabl.json'));

      const cached = translator.readFromCache([snippet]);

      expect(cached.translations).toHaveLength(1);
      expect(cached.remaining).toHaveLength(0);
      expect(translator.tablet.snippetKeys).toHaveLength(1);
    } finally {
      await rm(cacheDir, { force: true, recursive: true });
    }
  });
});

test('translator can install snippet dependencies with script', async () => {
  await withTemporaryDirectory(async (dir) => {
    // GIVEN: prepare dependency
    const snippetDepName = '@cdklabs/foobar';
    const snippetDepDir = 'foobar';
    mkdirSync(join(dir, snippetDepDir));
    writeFileSync(
      path.join(dir, snippetDepDir, 'package.json'),
      JSON.stringify(
        {
          name: snippetDepName,
          version: '0.0.1',
          private: true,
          scripts: {
            // fail the script
            postinstall: 'exit 1',
          },
        },
        undefined,
        2,
      ),
      {
        encoding: 'utf-8',
      },
    );

    const translator = new RosettaTranslator({
      includeCompilerDiagnostics: true,
    });

    const snippet: TypeScriptSnippet = {
      ...typeScriptSnippetFromVisibleSource('console.log("hello world");', location, true),
      compilationDependencies: {
        [snippetDepName]: {
          type: 'concrete',
          resolvedDirectory: path.resolve(dir, snippetDepDir),
        },
      },
    };

    const { translatedSnippets } = await translator.translateAll([snippet]);

    expect(translatedSnippets).toHaveLength(1);
    expect(translatedSnippets[0].get(TargetLanguage.PYTHON)?.source).toEqual('print("hello world")');

    expect(translator.tablet.snippetKeys).toHaveLength(1);
  });
});
