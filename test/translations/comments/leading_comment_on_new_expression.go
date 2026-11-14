// plain values
NewVpc(this, jsii.String("plain"), &vpcProps{
	Argument: jsii.Number(5),
})

// same text
NewVpc(this, jsii.String("A"), &vpcProps{
	Argument: jsii.Number(1),
})
// same text
NewVpc(this, jsii.String("B"), &vpcProps{
	Argument: jsii.Number(2),
})

/* block comment */
NewVpc(this, jsii.String("Block"), &vpcProps{
	Argument: jsii.Number(3),
})
