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

class TakingClass {
  public static takes(props: IFoo & IBar) {
  }
}
/// !show

TakingClass.takes(new ProvidedClass());


