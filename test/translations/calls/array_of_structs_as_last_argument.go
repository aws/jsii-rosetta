toolSchema_FromInline([]toolDefinition{
	&toolDefinition{
		Name: jsii.String("hello_world"),
		Description: jsii.String("A simple hello world tool"),
	},
})

toolSchema_FromInline([]toolDefinition{
	&toolDefinition{
		Name: jsii.String("a"),
		Description: jsii.String("first"),
	},
	&toolDefinition{
		Name: jsii.String("b"),
		Description: jsii.String("second"),
	},
})

withProps(&directProps{
	Foo: jsii.String("bar"),
})
