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
interface InputProps {
  readonly input: IFoo & IBar;
}

/// fake-from-jsii
class ProvidedClass implements IFoo, IBar {
  public readonly foo = 'foo';
  public readonly bar = 'bar';
}

class TakingClass2 {
  public static takes(props: InputProps) {
  }
}
/// !show

TakingClass2.takes({ input: new ProvidedClass() });


