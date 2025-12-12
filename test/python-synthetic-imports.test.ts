import { TestJsiiModule, DUMMY_JSII_CONFIG } from './testutil';
import { TargetLanguage, TranslatedSnippet } from '../lib';

describe('Python synthetic imports with visibility', () => {
  let module: TestJsiiModule;

  beforeAll(() => {
    module = TestJsiiModule.fromSource(
      {
        'index.ts': `
          export interface MyStruct {
            readonly value: string;
          }
          export interface MyClassProps {
            readonly myStruct: MyStruct;
          }       
          export class MyClass {
            constructor(_props: MyClassProps) {}
          }
        `,
      },
      {
        name: 'my_assembly',
        jsii: DUMMY_JSII_CONFIG,
      },
    );
  });

  afterAll(() => module.cleanup());

  test('includes import when type usage is visible', () => {
    const trans = module.translateHere(
      `import { MyClass } from 'my_assembly';
        const obj = new MyClass({
          myStruct: {
            value: 'v',
          },
        });
      `,
    );

    const python = expectTranslation(trans, TargetLanguage.PYTHON, [
      'from example_test_demo import MyStruct',
      'from example_test_demo import MyClass',
      'obj = MyClass(',
      '    my_struct=MyStruct(',
      '        value="v"',
      '    )',
      ')',
    ]);

    expect(python).toContain('from example_test_demo import MyStruct');
  });

  test('omits synthetic import when all type usages are hidden', () => {
    const trans = module.translateHere(
      `import { MyClass } from 'my_assembly';
        /// !hide
        new MyClass({
          myStruct: {
            value: 'v',
          },
        });
        /// !show
        
        declare const x: any;
        x;
      `,
    );

    const python = expectTranslation(trans, TargetLanguage.PYTHON, [
      'from example_test_demo import MyClass',
      '# x: Any',
      'x',
    ]);

    // Should not include synthetic import since all uses are hidden
    expect(python).not.toContain('from example_test_demo import MyStruct');
    expect(python).toContain('x');
  });

  test('includes import when at least one usage is visible', () => {
    const trans = module.translateHere(
      `import { MyClass } from 'my_assembly';
        /// !hide
        const hidden = new MyClass({ myStruct: { value: 'v' } });
        /// !show

        const visible = new MyClass({ myStruct: { value: 'v' } });
      `,
    );

    const python = expectTranslation(trans, TargetLanguage.PYTHON, [
      'from example_test_demo import MyStruct',
      'from example_test_demo import MyClass',
      'visible = MyClass(my_struct=MyStruct(value="v"))',
    ]);

    // Should include import since at least one usage is visible
    expect(python).toContain('from example_test_demo import MyStruct');
    expect(python).toContain('visible');
    expect(python).not.toContain('hidden');
  });
});

/**
 * Verify the output in the given language. All expected outputs look the same.
 */
function expectTranslation(trans: TranslatedSnippet, lang: TargetLanguage, expected: string[]) {
  const code = trans.get(lang)?.source ?? '';
  expect(code.split('\n')).toEqual(expected);
  return code;
}
