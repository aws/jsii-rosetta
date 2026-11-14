/// !hide
class HttpRouteKey {
  public static with(_path: string) {
    return new HttpRouteKey();
  }
  public static with_(_path: string) {
    return new HttpRouteKey();
  }
}
function takeMap(_xs: { [key: string]: string }) {}
/// !show
HttpRouteKey.with("path");
HttpRouteKey.with_("already");
takeMap({ with: "quoted-key" });
