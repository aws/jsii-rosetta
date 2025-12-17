import * as fs from 'node:fs';
import * as path from 'node:path';
import * as spec from '@jsii/spec';
import { fakeAssembly } from './fake-assembly';
import { withTemporaryDirectory } from '../testutil';
import { RosettaTranslator, typeScriptSnippetFromVisibleSource } from '../../lib';
import { TypeFingerprinter } from '../../lib/jsii/fingerprinting';

const location = { api: { api: 'file', fileName: 'test.ts' } as const };

test('writeDebugFile writes fingerprints in alphabetical order', async () => {
  await withTemporaryDirectory(async (dir) => {
    const debugFile = path.join(dir, 'fingerprints.txt');

    const assembly = fakeAssembly({
      name: 'my_assembly',
      types: {
        'my_assembly.ClassA': {
          kind: spec.TypeKind.Class,
          assembly: 'my_assembly',
          fqn: 'my_assembly.ClassA',
          name: 'ClassA',
        },
        'my_assembly.ClassB': {
          kind: spec.TypeKind.Class,
          assembly: 'my_assembly',
          fqn: 'my_assembly.ClassB',
          name: 'ClassB',
        },
      },
    });

    const fingerprinter = new TypeFingerprinter([assembly]);

    // Fingerprint types in reverse order to verify sorting
    fingerprinter.fingerprintType('my_assembly.ClassB');
    fingerprinter.fingerprintType('my_assembly.ClassA');

    fingerprinter.writeDebugFile(debugFile);

    expect(fs.existsSync(debugFile)).toBe(true);
    const content = fs.readFileSync(debugFile, 'utf-8');

    // Verify alphabetical order and format
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^my_assembly\.ClassA: [a-f0-9]{64}$/);
    expect(lines[1]).toMatch(/^my_assembly\.ClassB: [a-f0-9]{64}$/);
  });
});

test('DEBUG_TYPE_FINGERPRINTS writes debug file during translation', async () => {
  await withTemporaryDirectory(async (dir) => {
    const debugFile = path.join(dir, 'fingerprints.txt');
    const oldEnv = process.env.DEBUG_TYPE_FINGERPRINTS;
    process.env.DEBUG_TYPE_FINGERPRINTS = debugFile;

    try {
      const translator = new RosettaTranslator({ includeCompilerDiagnostics: true });
      const snippet = typeScriptSnippetFromVisibleSource('console.log("hello");', location, true);
      await translator.translateAll([snippet]);

      expect(fs.existsSync(debugFile)).toBe(true);
    } finally {
      if (oldEnv === undefined) {
        delete process.env.DEBUG_TYPE_FINGERPRINTS;
      } else {
        process.env.DEBUG_TYPE_FINGERPRINTS = oldEnv;
      }
    }
  });
});
