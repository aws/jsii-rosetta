// plain values
Vpc.Builder.create(this, "plain")
        .argument(5)
        .build();

// same text
Vpc.Builder.create(this, "A")
        .argument(1)
        .build();
// same text
Vpc.Builder.create(this, "B")
        .argument(2)
        .build();

/* block comment */
Vpc.Builder.create(this, "Block")
        .argument(3)
        .build();
