/// !hide
/// fake-from-jsii
class Vpc {
  constructor(_something: any, id: string, props: VpcProps) { }
}
interface VpcProps { readonly argument: number }
// hidden comment must not leak
new Vpc(this, "hidden", {
  argument: 0
});
/// !show

// plain values
new Vpc(this, "plain", {
  argument: 5
});

// same text
new Vpc(this, "A", {
  argument: 1
});
// same text
new Vpc(this, "B", {
  argument: 2
});

/* block comment */
new Vpc(this, "Block", {
  argument: 3
});
