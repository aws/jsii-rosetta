class MyResource:

    def __init__(self, resource):
        self.resource = resource
        self.env = "production"

    def description(self):
        return self.resource

r = MyResource("bucket")
