/// !hide
/// fake-from-jsii
interface IFoo {
  readonly foo: string;
}

/// fake-from-jsii
interface IBar {
  readonly bar: string;
}

/// fake-from-jsii
class ProvidedClass implements IFoo, IBar {
  public readonly foo = 'foo';
  public readonly bar = 'bar';
}

/// fake-from-jsii
interface TakingClass3Props {
  readonly input: IFoo & IBar;
}

/// fake-from-jsii
class TakingClass3 {
  public constructor(props: TakingClass3Props) {
  }
}
/// !show

new TakingClass3({ input: new ProvidedClass() });


