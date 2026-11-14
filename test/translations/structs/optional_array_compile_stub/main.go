package main

// Compile check for pointer-to-slice struct fields (jsii-pacmak *[]*T).
//
//   go build -o /dev/null .
//
// from this directory.

func String(v string) *string { return &v }

type item struct {
	Name *string
}

type responseHeadersPolicyProps struct {
	RemoveHeaders   *[]*string
	RequiredHeaders *[]*string
	Items           *[]*item
	Nested          *[]*[]*string
}

type policy struct {
	Name          *string
	RemoveHeaders *[]*string
}

func main() {
	_ = &responseHeadersPolicyProps{
		RemoveHeaders: &[]*string{
			String("Server"),
		},
		RequiredHeaders: &[]*string{
			String("X-Custom"),
		},
		Items: &[]*item{
			{
				Name: String("n"),
			},
		},
		Nested: &[]*[]*string{
			&[]*string{
				String("a"),
				String("b"),
			},
		},
	}

	_ = &responseHeadersPolicyProps{
		RemoveHeaders: (&[]*string{
			String("Paren"),
		}),
	}

	_ = map[string]*policy{
		"a": {
			Name: String("n"),
			RemoveHeaders: &[]*string{
				String("Server"),
			},
		},
	}
}
