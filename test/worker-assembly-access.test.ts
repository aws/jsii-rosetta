import * as path from 'node:path';

import { translateAll } from '../lib/translate_all';
import { typeScriptSnippetFromCompleteSource } from '../lib/snippet';
import { testSnippetLocation } from './testutil';

const PLUGIN = path.resolve(__dirname, 'fixtures', 'assembly-aware-language-plugin.js');

// A worker can be told to load a language plugin, but not what it is
// translating for. That is fine for the built-in languages — Java and C# reach
// a type through a namespace import, and none of them render differently for
// an enum member than for a static property — but it is not fine in general:
// a published example does not typecheck (its fixtures are not shipped), so
// the assembly is the only thing that can say what a name refers to.
//
// Without this, a plugin has to smuggle the assemblies in through the
// environment, which is a side channel the contract does not describe and
// every language would reinvent differently.
describe('assembly locations reach language plugins in workers', () => {
  const snippet = () =>
    typeScriptSnippetFromCompleteSource(
      'const someValue = 1;',
      testSnippetLocation('worker-assembly-access'),
      false,
    );

  const ASSEMBLIES = ['/some/assembly/one', '/some/assembly/two'];

  test('a plugin is told which assemblies are being translated', async () => {
    const result = await translateAll([snippet()], false, undefined, [PLUGIN], ASSEMBLIES);
    const translated = result.translatedSnippets[0];
    // The fixture renders `<name>@<count>`; 2 means both locations arrived.
    expect(translated.snippet.translations!['assembly-aware-plugin'].source).toContain(
      'someValue@2',
    );
  });

  test('a plugin told nothing still translates', async () => {
    // Not every caller has assemblies (a bare `translate` does not), so the
    // hook must be optional rather than a precondition.
    const result = await translateAll([snippet()], false, undefined, [PLUGIN]);
    const translated = result.translatedSnippets[0];
    expect(translated.snippet.translations!['assembly-aware-plugin'].source).toContain(
      'someValue@0',
    );
  });

  test('built-in languages are unaffected', async () => {
    const result = await translateAll([snippet()], false, undefined, [PLUGIN], ASSEMBLIES);
    const translated = result.translatedSnippets[0];
    expect(Object.keys(translated.snippet.translations ?? {})).toContain('python');
  });
});
