HttpRouteKey.With("path");
HttpRouteKey.With_("already");
obj.With("path");
CreateRoute(new RouteOptions { As = "alias" });
TakeMap(new Dictionary<string, object> { { "with", "quoted-key" } });
TakeMap(new Dictionary<string, object> { { "with", 1 } });
TakeMap(new Dictionary<string, object> { { "from", from } });
