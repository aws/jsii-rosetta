type myResource struct {
	env *string
	resource *string
}

func newMyResource(resource *string) *myResource {
	this := &myResource{}
	this.resource = resource
	this.env = jsii.String("production")
	return this
}

func (this *myResource) description() *string {
	return this.resource
}

r := newMyResource(jsii.String("bucket"))
