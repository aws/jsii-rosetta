ToolSchema.FromInline(new [] { new ToolDefinition {
    Name = "hello_world",
    Description = "A simple hello world tool"
} });

ToolSchema.FromInline(new [] { new ToolDefinition {
    Name = "a",
    Description = "first"
}, new ToolDefinition {
    Name = "b",
    Description = "second"
} });

WithProps(new DirectProps {
    Foo = "bar"
});
