new ResponseHeadersPolicy(this, "Policy", new ResponseHeadersPolicyProps {
    RemoveHeaders = new [] { "Server" },
    RequiredHeaders = new [] { "X-Custom" },
    Items = new [] { new Item { Name = "n" } },
    Tags = new Dictionary<string, string> { { "env", "prod" } }
});

new ResponseHeadersPolicy(this, "Empty", new ResponseHeadersPolicyProps {
    RequiredHeaders = new [] {  },
    RemoveHeaders = new [] {  }
});

TakesHeaders(new [] { "arg" });
