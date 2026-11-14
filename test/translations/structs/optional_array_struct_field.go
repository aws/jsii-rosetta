NewResponseHeadersPolicy(this, jsii.String("Policy"), &responseHeadersPolicyProps{
	RemoveHeaders: &[]*string{
		jsii.String("Server"),
	},
	ParenHeaders: (&[]*string{
		jsii.String("Paren"),
	}),
	AsHeaders: &[]*string{
		jsii.String("As"),
	},
	BangHeaders: &[]*string{
		jsii.String("Bang"),
	},
	RequiredHeaders: &[]*string{
		jsii.String("X-Custom"),
	},
	Items: &[]*item{
		&item{
			Name: jsii.String("n"),
		},
	},
	Nested: &[]*[]*string{
		&[]*string{
			jsii.String("a"),
			jsii.String("b"),
		},
	},
	Tags: map[string]*string{
		"env": jsii.String("prod"),
	},
})

NewResponseHeadersPolicy(this, jsii.String("Empty"), &responseHeadersPolicyProps{
	RequiredHeaders: &[]*string{
	},
	RemoveHeaders: &[]*string{
	},
})

takesHeaders([]*string{
	jsii.String("arg"),
})
