import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { TestJsiiModule, DUMMY_JSII_CONFIG } from './testutil';
import { extractSnippets } from '../lib/commands/extract';
import { allTargetLanguages, registerTargetLanguage, visitorFactoryFor } from '../lib/languages';
import * as pluginApi from '../lib/plugin-api';
import { isCompatiblePluginApi, PLUGIN_API_VERSION, resolvePluginModules } from '../lib/plugins';
import { LanguageTablet } from '../lib/tablets/tablets';

jest.setTimeout(120_000);

const SHOUTY_PLUGIN = path.resolve(__dirname, 'fixtures', 'shouty-language-plugin.js');

const factory = (version: string) => ({ version, createVisitor: () => ({} as any) });

describe('isCompatiblePluginApi', () => {
  test('while experimental (0.x), the minor version must match too', () => {
    expect(isCompatiblePluginApi('0.1.0', '0.1.0')).toBe(true);
    expect(isCompatiblePluginApi('0.1.3', '0.1.0')).toBe(true);
    expect(isCompatiblePluginApi('0.1.0', '0.2.0')).toBe(false);
    expect(isCompatiblePluginApi('0.2.0', '0.1.0')).toBe(false);
  });

  test('from 1.0, a plugin may be older within the same major, but not newer', () => {
    expect(isCompatiblePluginApi('1.0.0', '1.2.0')).toBe(true);
    expect(isCompatiblePluginApi('1.3.0', '1.2.0')).toBe(false);
    expect(isCompatiblePluginApi('1.0.0', '2.0.0')).toBe(false);
  });

  test('a malformed version is never compatible', () => {
    expect(isCompatiblePluginApi('0.1', '0.1.0')).toBe(false);
    expect(isCompatiblePluginApi('latest', '0.1.0')).toBe(false);
  });
});

describe('registerTargetLanguage', () => {
  test('requires the plugin API version the plugin was written against', () => {
    expect(() => registerTargetLanguage('no-version', factory('1'), undefined as any)).toThrow(
      /must declare the 'pluginApiVersion'/,
    );
  });

  test('refuses an incompatible plugin API version', () => {
    expect(() => registerTargetLanguage('too-new', factory('1'), { pluginApiVersion: '99.0.0' })).toThrow(
      /requires plugin API 99\.0\.0/,
    );
  });

  test('registering the same language and visitor version again does nothing', () => {
    const first = factory('1');
    registerTargetLanguage('twice', first, { pluginApiVersion: PLUGIN_API_VERSION });
    registerTargetLanguage('twice', factory('1'), { pluginApiVersion: PLUGIN_API_VERSION });
    expect(visitorFactoryFor('twice')).toBe(first);
  });

  test('registering a different visitor version for the same language is an error', () => {
    registerTargetLanguage('conflicting', factory('1'), { pluginApiVersion: PLUGIN_API_VERSION });
    expect(() => registerTargetLanguage('conflicting', factory('2'), { pluginApiVersion: PLUGIN_API_VERSION })).toThrow(
      /already registered with visitor version 1/,
    );
  });

  test('a language named like an Object.prototype member is just a name', () => {
    expect(visitorFactoryFor('constructor')).toBeUndefined();
    const ctor = factory('1');
    registerTargetLanguage('constructor', ctor, { pluginApiVersion: PLUGIN_API_VERSION });
    expect(visitorFactoryFor('constructor')).toBe(ctor);
  });
});

describe('resolvePluginModules', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rosetta-plugins-'));
    fs.writeFileSync(path.join(dir, 'local-plugin.js'), '');
    fs.mkdirSync(path.join(dir, 'node_modules', 'installed-plugin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'installed-plugin', 'index.js'), '');
  });
  afterEach(() => fs.rmSync(dir, { force: true, recursive: true }));

  test('resolves a relative path against the given directory, not jsii-rosetta', () => {
    expect(resolvePluginModules(['./local-plugin'], dir)).toEqual([path.join(dir, 'local-plugin.js')]);
  });

  test("resolves a package name from the given directory's node_modules", () => {
    expect(resolvePluginModules(['installed-plugin'], dir)).toEqual([
      path.join(dir, 'node_modules', 'installed-plugin', 'index.js'),
    ]);
  });
});

describe('extractSnippets with a language plugin', () => {
  let assembly: TestJsiiModule;
  beforeEach(() => {
    assembly = TestJsiiModule.fromSource(
      {
        'index.ts': 'export class ClassA { public someMethod() {} }',
        'README.md': "```ts\nimport * as ass from 'my_assembly';\nnew ass.ClassA().someMethod();\n```",
      },
      { name: 'my_assembly', jsii: DUMMY_JSII_CONFIG },
    );
  });
  afterEach(() => assembly.cleanup());

  test('one option registers the language here and in every worker, from a relative path', async () => {
    const cacheToFile = path.join(assembly.moduleDirectory, 'test.tabl.json');
    const relativeSpec = `./${path.relative(process.cwd(), SHOUTY_PLUGIN)}`;
    expect(allTargetLanguages()).not.toContain('shouty-plugin');

    await extractSnippets([assembly.moduleDirectory], {
      cacheToFile,
      includeCompilerDiagnostics: false,
      validateAssemblies: false,
      pluginModules: [relativeSpec],
    });

    // Registered in this process, where cached translations are checked...
    expect(allTargetLanguages()).toContain('shouty-plugin');
    // ...and translated by the workers.
    const tablet = new LanguageTablet();
    await tablet.load(cacheToFile);
    const [key] = tablet.snippetKeys;
    expect(tablet.tryGetSnippet(key)?.snippet.translations?.['shouty-plugin']?.source).toContain('SOMEMETHOD');
  });
});

describe('assembly locations given to a language plugin', () => {
  const LOCATION_PLUGIN = path.resolve(__dirname, 'fixtures', 'location-checking-language-plugin.js');

  let assembly: TestJsiiModule;
  beforeEach(() => {
    assembly = TestJsiiModule.fromSource(
      {
        'index.ts': 'export class ClassA { public someMethod() {} }',
        'README.md': "```ts\nimport * as ass from 'my_assembly';\nnew ass.ClassA().someMethod();\n```",
      },
      { name: 'my_assembly', jsii: DUMMY_JSII_CONFIG },
    );
  });
  afterEach(() => assembly.cleanup());

  test('can be opened by a worker, even when the caller passed a relative path', async () => {
    const cacheToFile = path.join(assembly.moduleDirectory, 'test.tabl.json');

    // A short relative path, from the assembly's parent directory. (One that
    // climbs to the filesystem root resolves the same from anywhere.)
    const origDir = process.cwd();
    process.chdir(path.dirname(assembly.moduleDirectory));
    try {
      await extractSnippets([path.basename(assembly.moduleDirectory)], {
        cacheToFile,
        includeCompilerDiagnostics: false,
        validateAssemblies: false,
        pluginModules: [LOCATION_PLUGIN],
      });
    } finally {
      process.chdir(origDir);
    }

    const tablet = new LanguageTablet();
    await tablet.load(cacheToFile);
    const [key] = tablet.snippetKeys;
    expect(tablet.tryGetSnippet(key)?.snippet.translations?.['location-checking-plugin']?.source).toContain(
      'someMethod@found',
    );
  });
});

describe('plugin-api', () => {
  test('exports what an out-of-tree language needs at runtime', () => {
    // The values the reference Ruby plugin uses; the types it uses are checked
    // by this file compiling against the module.
    expect(pluginApi.PLUGIN_API_VERSION).toBe(PLUGIN_API_VERSION);
    for (const name of [
      'registerTargetLanguage',
      'visitorFactoryFor',
      'DefaultVisitor',
      'AstRenderer',
      'OTree',
      'SubmoduleReference',
      'matchAst',
      'nodeOfType',
      'stripCommentMarkers',
      'voidExpressionString',
      'inferredTypeOfExpression',
      'isEnumAccess',
      'isStaticReadonlyAccess',
      'parameterAcceptsUndefined',
      'analyzeObjectLiteral',
      'analyzeStructType',
      'isJsiiProtocolType',
      'lookupJsiiSymbolFromNode',
      'simpleName',
      'jsiiTargetParameter',
      'translateTypeScript',
      'extractSnippets',
      'enforcesStrictMode',
    ] as const) {
      expect(typeof pluginApi[name]).toBe('function');
    }
    expect(pluginApi.NO_SYNTAX).toBeDefined();
  });
});
