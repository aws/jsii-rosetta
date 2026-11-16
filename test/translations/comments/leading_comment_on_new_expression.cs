// plain values
new Vpc(this, "plain", new VpcProps {
    Argument = 5
});

// same text
new Vpc(this, "A", new VpcProps {
    Argument = 1
});
// same text
new Vpc(this, "B", new VpcProps {
    Argument = 2
});

/* block comment */
new Vpc(this, "Block", new VpcProps {
    Argument = 3
});
