NewResponseHeadersPolicy(this, jsii.String("Policy"), &responseHeadersPolicyProps{
	RemoveHeaders: &[]*string{
		jsii.String("Server"),
	},
	RequiredHeaders: &[]*string{
		jsii.String("X-Custom"),
	},
	Items: &[]*item{
		&item{
			Name: jsii.String("n"),
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
