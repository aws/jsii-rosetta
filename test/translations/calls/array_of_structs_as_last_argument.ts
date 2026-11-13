/// !hide
/// fake-from-jsii
interface ToolDefinition {
  readonly name: string;
  readonly description: string;
}

interface DirectProps {
  readonly foo: string;
}

class ToolSchema {
  public static fromInline(_tools: ToolDefinition[]): void { }
}

function withProps(_props: DirectProps) { }
/// !show
ToolSchema.fromInline([{
  name: "hello_world",
  description: "A simple hello world tool",
}]);

ToolSchema.fromInline([{
  name: "a",
  description: "first",
}, {
  name: "b",
  description: "second",
}]);

withProps({
  foo: "bar",
});
