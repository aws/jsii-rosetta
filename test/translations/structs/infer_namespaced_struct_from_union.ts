/// !hide
/// fake-from-jsii
interface IResolvable {
  resolve(): any;
}

namespace MyLib {
  /// fake-from-jsii
  interface SomeStruct {
    readonly enabled: boolean | IResolvable;
    readonly option?: string | IResolvable;
  }

  /// fake-from-jsii
  export interface MyProps {
    readonly struct?: IResolvable | SomeStruct;
  }
}

function takes(props: MyLib.MyProps) {}
/// !show

takes({
  struct: {
    enabled: false,
    option: 'option',
  },
});
