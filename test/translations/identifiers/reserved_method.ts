/// !hide
/// fake-from-jsii
interface RouteOptions {
  readonly as: string;
}
class HttpRouteKey {
  public static with(_path: string) {
    return new HttpRouteKey();
  }
  public static with_(_path: string) {
    return new HttpRouteKey();
  }
  public with(_path: string) {
    return this;
  }
}
function takeMap(_xs: { [key: string]: string | number }) {}
function createRoute(_opts: RouteOptions) {}
declare const obj: HttpRouteKey;
declare const from: string;
/// !show
HttpRouteKey.with("path");
HttpRouteKey.with_("already");
obj.with("path");
createRoute({ as: "alias" });
takeMap({ with: "quoted-key" });
takeMap({ 'with': 1 });
takeMap({ from });
