new ResponseHeadersPolicy(this, "Policy", new ResponseHeadersPolicyProps {
    RemoveHeaders = new [] { "Server" },
    ParenHeaders = (new [] { "Paren" }),
    AsHeaders = (string[])new [] { "As" },
    BangHeaders = new [] { "Bang" },
    RequiredHeaders = new [] { "X-Custom" },
    Items = new [] { new Item { Name = "n" } },
    Nested = new [] { new [] { "a", "b" } },
    Tags = new Dictionary<string, string> { { "env", "prod" } }
});

new ResponseHeadersPolicy(this, "Empty", new ResponseHeadersPolicyProps {
    RequiredHeaders = new [] {  },
    RemoveHeaders = new [] {  }
});

TakesHeaders(new [] { "arg" });
