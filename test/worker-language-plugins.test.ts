import * as path from 'node:path';

import { translateAll } from '../lib/translate_all';
import { typeScriptSnippetFromCompleteSource } from '../lib/snippet';
import { testSnippetLocation } from './testutil';

const PLUGIN = path.resolve(__dirname, 'fixtures', 'shouty-language-plugin.js');

// Translation is farmed out to worker threads, which are fresh module
// contexts: a language registered in the main thread does not exist there.
// Without a way to load plugins in the workers, an externally registered
// language is silently absent from everything `extract` produces — the tablet
// looks fine, it just has no translations for that language, and the failure
// only shows up much later as untranslated examples in published docs.
describe('language plugins in worker threads', () => {
  const snippet = () =>
    typeScriptSnippetFromCompleteSource(
      'const someValue = 1;',
      testSnippetLocation('worker-language-plugins'),
      false,
    );

  test('a plugin language is translated when the workers are told to load it', async () => {
    const result = await translateAll([snippet()], false, undefined, [PLUGIN]);
    const translated = result.translatedSnippets[0];
    expect(Object.keys(translated.snippet.translations ?? {})).toContain('shouty-plugin');
  });

  test('the plugin language actually renders through its visitor', async () => {
    const result = await translateAll([snippet()], false, undefined, [PLUGIN]);
    const translated = result.translatedSnippets[0];
    expect(translated.snippet.translations!['shouty-plugin'].source).toContain('SOMEVALUE');
  });

  test('built-in languages are unaffected', async () => {
    const result = await translateAll([snippet()], false, undefined, [PLUGIN]);
    const translated = result.translatedSnippets[0];
    expect(Object.keys(translated.snippet.translations ?? {})).toContain('python');
  });

  test('without the plugin, the language is simply absent', async () => {
    // The status quo, pinned so the difference is unmistakable.
    const result = await translateAll([snippet()], false);
    const translated = result.translatedSnippets[0];
    expect(Object.keys(translated.snippet.translations ?? {})).not.toContain('shouty-plugin');
  });
});
