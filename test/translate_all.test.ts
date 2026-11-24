import * as path from 'node:path';

import { TargetLanguage } from '../lib/languages';
import { typeScriptSnippetFromVisibleSource } from '../lib/snippet';
import { translateAll } from '../lib/translate_all';

const snippet = typeScriptSnippetFromVisibleSource(
  'console.log("hello world");',
  { api: { api: 'file', fileName: 'test.ts' } },
  true,
);

test.each([
  ['in worker threads', undefined],
  ['in the main thread when the worker script is missing', path.join(__dirname, 'does-not-exist.js')],
])('translates %s', async (_, workerScript) => {
  const result = await translateAll([snippet], false, undefined, workerScript);

  expect(result.diagnostics).toEqual([]);
  expect(result.translatedSnippets[0].get(TargetLanguage.PYTHON)?.source).toEqual('print("hello world")');
});
