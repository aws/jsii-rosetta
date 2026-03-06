import { markDownToStructure, markDownToXmlDoc } from '../../src';

const DEBUG = false;

test('emphasis and lists', () => {
  expectOutput(
    `
# Hello
## Bye

This is *very* **cool**.

* Yes
* Really
`,
    `
<h1>Hello</h1>

<h2>Bye</h2>

This is <em>very</em> <strong>cool</strong>.

<list type="bullet">
<description>Yes</description>
<description>Really</description>
</list>
`,
  );
});

test('special characters are escaped', () => {
  expectOutput(
    `
  Escape this & and this < and this >

  ` +
      '```' +
      `
  if (x < 3) {
    System.Console.WriteLn("bloep");
  }
  ` +
      '```',
    `
Escape this &amp; and this &lt; and this &gt;

<code><![CDATA[
if (x < 3) {
  System.Console.WriteLn("bloep");
}
]]></code>
  `,
  );
});

test('quotes are escaped inside attributes', () => {
  expectOutput(
    `
  ['tis but a "scratch"](http://bla.ck/"kni"gh&t)

  ![nay merely a "flesh wound" &cet](http://bla.ck/"kni"gh&t.jpg)
  `,
    `
<a href="http://bla.ck/%22kni%22gh&amp;t">'tis but a "scratch"</a>

<img alt="nay merely a &quot;flesh wound&quot; &amp;cet" src="http://bla.ck/%22kni%22gh&amp;t.jpg" />
  `,
  );
});

test('convert header properly', () => {
  expectOutput(
    `
  <!--BEGIN STABILITY BANNER-->

  ---

  ![Stability: Stable](https://img.shields.io/badge/stability-Stable-success.svg?style=for-the-badge)

  ---
  <!--END STABILITY BANNER-->
  `,
    `
<!--BEGIN STABILITY BANNER-->

<hr />

<img alt="Stability: Stable" src="https://img.shields.io/badge/stability-Stable-success.svg?style=for-the-badge" />

<hr />

  <!--END STABILITY BANNER-->
  `,
  );
});

test('unclosed placeholder tags are escaped without stderr noise', () => {
  // These are common in AWS docs as placeholders like <region>, <account-id>, etc.
  // CommonMark parses them as html_inline nodes. The DOMParser should not log errors to stderr.
  const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expectOutput(
      'app/<load-balancer-name>/<load-balancer-id>',
      'app/&lt;load-balancer-name&gt;/&lt;load-balancer-id&gt;',
    );
    expect(stderrWrite).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    stderrWrite.mockRestore();
    consoleError.mockRestore();
  }
});

test('prohibited XML characters are stripped from text', () => {
  // CommonMark replaces \x00 with \uFFFD, so we test chars that pass through unchanged
  expectOutput('Hello\x08\x0B\x0C\x0E\x1FWorld', 'HelloWorld');
});

test('prohibited XML characters are stripped from inline code', () => {
  expectOutput('`code\x01here`', '<c>codehere</c>');
});

test('prohibited XML characters are stripped from attributes', () => {
  expectOutput(
    '![alt\x01text](http://example.com/img\x02.png)',
    '<img alt="alttext" src="http://example.com/img%02.png" />',
  );
});

test('allowed control characters are preserved', () => {
  // tab (0x09), newline (0x0A), carriage return (0x0D) are valid in XML
  expectOutput('Hello\tWorld', 'Hello\tWorld');
});

test('prohibited XML characters combined with other escapes', () => {
  expectOutput('a\x01&\x02<\x03>b', 'a&amp;&lt;&gt;b');
});

function expectOutput(source: string, expected: string) {
  if (DEBUG) {
    // tslint:disable-next-line:no-console
    console.log(markDownToStructure(source));
  }

  const output = markDownToXmlDoc(source);
  expect(output.trim()).toEqual(expected.trim());
}
