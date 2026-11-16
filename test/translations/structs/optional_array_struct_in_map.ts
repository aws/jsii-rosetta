/// !hide
/// fake-from-jsii
interface Policy {
  readonly name: string;
  readonly removeHeaders?: string[];
}

function putPolicies(_policies: { [key: string]: Policy }): void { }
/// !show
putPolicies({
  a: {
    name: 'n',
    removeHeaders: ['Server'],
  },
});
