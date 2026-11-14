/// !hide
/// fake-from-jsii
class ResponseHeadersPolicy {
  constructor(_scope: any, _id: string, _props?: ResponseHeadersPolicyProps) { }
}

interface ResponseHeadersPolicyProps {
  readonly removeHeaders?: string[];
  readonly parenHeaders?: string[];
  readonly asHeaders?: string[];
  readonly bangHeaders?: string[];
  readonly requiredHeaders: string[];
  readonly items?: Item[];
  readonly nested?: string[][];
  readonly tags?: { [key: string]: string };
}

interface Item {
  readonly name: string;
}

function takesHeaders(_headers: string[]): void { }
/// !show
new ResponseHeadersPolicy(this, 'Policy', {
  removeHeaders: ['Server'],
  parenHeaders: (['Paren']),
  asHeaders: ['As'] as string[],
  bangHeaders: ['Bang']!,
  requiredHeaders: ['X-Custom'],
  items: [{ name: 'n' }],
  nested: [['a', 'b']],
  tags: { env: 'prod' },
});

new ResponseHeadersPolicy(this, 'Empty', {
  requiredHeaders: [],
  removeHeaders: [],
});

takesHeaders(['arg']);
