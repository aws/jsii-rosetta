ToolSchema.from_inline([ToolDefinition(
    name="hello_world",
    description="A simple hello world tool"
)])

ToolSchema.from_inline([ToolDefinition(
    name="a",
    description="first"
), ToolDefinition(
    name="b",
    description="second"
)])

with_props(
    foo="bar"
)
