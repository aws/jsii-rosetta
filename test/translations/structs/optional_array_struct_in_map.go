putPolicies(map[string]policy{
	"a": &policy{
		Name: jsii.String("n"),
		RemoveHeaders: &[]*string{
			jsii.String("Server"),
		},
	},
})
