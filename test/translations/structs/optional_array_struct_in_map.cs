PutPolicies(new Dictionary<string, Policy> {
    { "a", new Policy {
        Name = "n",
        RemoveHeaders = new [] { "Server" }
    } }
});
