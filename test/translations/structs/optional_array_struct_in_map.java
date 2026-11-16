putPolicies(Map.of(
        "a", Policy.builder()
                .name("n")
                .removeHeaders(List.of("Server"))
                .build()));
