ResponseHeadersPolicy(self, "Policy",
    remove_headers=["Server"],
    paren_headers=(["Paren"]),
    as_headers=["As"],
    bang_headers=["Bang"],
    required_headers=["X-Custom"],
    items=[Item(name="n")],
    nested=[["a", "b"]],
    tags={"env": "prod"}
)

ResponseHeadersPolicy(self, "Empty",
    required_headers=[],
    remove_headers=[]
)

takes_headers(["arg"])
