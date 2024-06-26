import { testSnippetLocation } from './testutil';
import { fixturize } from '../lib/fixtures';
import { SnippetParameters } from '../lib/snippet';

const location = testSnippetLocation('where');

describe('fixturize', () => {
  test('snippet retains properties', () => {
    const snippet = {
      visibleSource: 'visibleSource',
      location,
      parameters: {
        [SnippetParameters.$PROJECT_DIRECTORY]: 'directory',
        [SnippetParameters.NO_FIXTURE]: '',
        key: 'value',
      },
      strict: true,
    };

    expect(fixturize(snippet)).toEqual(expect.objectContaining(snippet));
  });

  test('separates imports and declarations', () => {
    const source = `import * as ns from 'mod';
declare const mock: Tpe;
const val = new Cls();`;
    const snippet = {
      visibleSource: source,
      location,
      parameters: {
        [SnippetParameters.$PROJECT_DIRECTORY]: 'test',
      },
      strict: true,
    };

    const fixturizedSnippet = fixturize(snippet);

    expect(fixturizedSnippet.completeSource).toBe(`// Hoisted imports begin after !show marker below
/// !show
import * as ns from 'mod';
declare const mock: Tpe;
/// !hide
// Hoisted imports ended before !hide marker above
// Code snippet begins after !show marker below
/// !show

const val = new Cls();
/// !hide
// Code snippet ended before !hide marker above
`);
  });

  // https://github.com/aws/jsii-rosetta/issues/1161
  test('regression: can parse source with jsdoc annotated export', () => {
    const snippet = {
      visibleSource: `
        /**
         * JSDoc
         */
        export const foo = "bar";
      `,
      location,
      parameters: {
        [SnippetParameters.$PROJECT_DIRECTORY]: 'test',
      },
    };

    expect(fixturize(snippet)).toEqual(expect.objectContaining(snippet));
  });
});
