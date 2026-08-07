/// !hide
/// fake-from-jsii
export interface IFoo {
  readonly foo: string;
}

/// fake-from-jsii
export interface IBar {
  readonly bar: string;
}
/// !show

declare const someObject: IFoo & IBar;


