ResponseHeadersPolicy.Builder.create(this, "Policy")
        .removeHeaders(List.of("Server"))
        .requiredHeaders(List.of("X-Custom"))
        .items(List.of(Item.builder().name("n").build()))
        .tags(Map.of("env", "prod"))
        .build();

ResponseHeadersPolicy.Builder.create(this, "Empty")
        .requiredHeaders(List.of())
        .removeHeaders(List.of())
        .build();

takesHeaders(List.of("arg"));
