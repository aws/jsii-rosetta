/// !hide
/// fake-from-jsii
class ResponseHeadersPolicy {
  constructor(_scope: any, _id: string, _props?: ResponseHeadersPolicyProps) { }
}

interface ResponseHeadersPolicyProps {
  readonly removeHeaders?: string[];
  readonly requiredHeaders: string[];
  readonly items?: Item[];
  readonly tags?: { [key: string]: string };
}

interface Item {
  readonly name: string;
}

function takesHeaders(_headers: string[]): void { }
/// !show
new ResponseHeadersPolicy(this, 'Policy', {
  removeHeaders: ['Server'],
  requiredHeaders: ['X-Custom'],
  items: [{ name: 'n' }],
  tags: { env: 'prod' },
});

new ResponseHeadersPolicy(this, 'Empty', {
  requiredHeaders: [],
  removeHeaders: [],
});

takesHeaders(['arg']);
