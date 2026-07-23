import { DUMMY_JSII_CONFIG, TestJsiiModule } from './testutil';
import { TargetLanguage } from '../lib/languages';

describe('Ruby: an uninitialised declaration keeps its type as a comment', () => {
  let module: TestJsiiModule;

  beforeAll(() => {
    module = TestJsiiModule.fromSource(
      { 'index.ts': `export interface IBucket { readonly bucketName: string; }` },
      { name: 'my_assembly', jsii: DUMMY_JSII_CONFIG },
    );
  });

  afterAll(() => module.cleanup());

  test('`declare const bucket: IBucket` -> `bucket = nil # <RubyType>`', () => {
    const trans = module.translateHere(`
      import { IBucket } from 'my_assembly';
      declare const bucket: IBucket;
      Array.isArray(bucket);
    `);
    const ruby = trans.get(TargetLanguage.RUBY)?.source ?? '';
    // The type (IBucket) is preserved as a trailing comment on the placeholder, rather
    // than dropped — resolved to its fully-qualified Ruby name.
    expect(ruby).toMatch(/^bucket = nil # \S*IBucket$/m);
  });
});
