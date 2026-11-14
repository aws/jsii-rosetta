ResponseHeadersPolicy(self, "Policy",
    remove_headers=["Server"],
    required_headers=["X-Custom"],
    items=[Item(name="n")],
    tags={"env": "prod"}
)

ResponseHeadersPolicy(self, "Empty",
    required_headers=[],
    remove_headers=[]
)

takes_headers(["arg"])
