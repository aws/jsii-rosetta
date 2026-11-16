ToolSchema.fromInline(List.of(ToolDefinition.builder()
        .name("hello_world")
        .description("A simple hello world tool")
        .build()));

ToolSchema.fromInline(List.of(ToolDefinition.builder()
        .name("a")
        .description("first")
        .build(), ToolDefinition.builder()
        .name("b")
        .description("second")
        .build()));

withProps(DirectProps.builder()
        .foo("bar")
        .build());
