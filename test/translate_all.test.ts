import * as path from 'node:path';

import { TargetLanguage } from '../lib/languages';
import { typeScriptSnippetFromVisibleSource } from '../lib/snippet';
import { translateAll } from '../lib/translate_all';

const snippet = typeScriptSnippetFromVisibleSource(
  'console.log("hello world");',
  { api: { api: 'file', fileName: 'test.ts' } },
  true,
);

test('translates in worker threads', async () => {
  const result = await translateAll([snippet], false);

  expect(result.diagnostics).toEqual([]);
  expect(result.translatedSnippets[0].get(TargetLanguage.PYTHON)?.source).toEqual('print("hello world")');
});

test('explains how to bundle the worker when it is missing', async () => {
  const workerScript = path.join(__dirname, 'does-not-exist.js');

  await expect(translateAll([snippet], false, undefined, workerScript)).rejects.toThrow(
    /worker script not found: .*does-not-exist\.js\. .*#bundling-jsii-rosetta/,
  );
});
