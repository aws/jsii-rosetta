class MyClass < Cdk::SomeOtherClass
  def initialize(scope, id, props)
    super(scope, id, props)

    puts(props[:prop1])
  end
end