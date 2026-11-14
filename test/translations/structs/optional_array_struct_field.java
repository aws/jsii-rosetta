ResponseHeadersPolicy.Builder.create(this, "Policy")
        .removeHeaders(List.of("Server"))
        .parenHeaders((List.of("Paren")))
        .asHeaders((String[])List.of("As"))
        .bangHeaders(List.of("Bang"))
        .requiredHeaders(List.of("X-Custom"))
        .items(List.of(Item.builder().name("n").build()))
        .nested(List.of(List.of("a", "b")))
        .tags(Map.of("env", "prod"))
        .build();

ResponseHeadersPolicy.Builder.create(this, "Empty")
        .requiredHeaders(List.of())
        .removeHeaders(List.of())
        .build();

takesHeaders(List.of("arg"));
