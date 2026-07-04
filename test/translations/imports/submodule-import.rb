require 'jsii-calc'
require 'jsii-calc'
require_relative './.gen/providers/aws'

# Access without existing type information
aws_kms_key_examplekms = AWS::KMS::KMSKey.new(self, "examplekms", {
    deletion_window_in_days: 7,
    description: "KMS key 1"
})

# Accesses two distinct points of the submodule hierarchy
my_class = JsiiCalc::Submodule::MyClass.new({prop: JsiiCalc::Submodule::Child::SomeEnum::SOME})

# Access via a renamed import
JsiiCalc::HomonymousForwardReferences::Foo::Consumer.consume({homonymous: {string_property: "yes"}})