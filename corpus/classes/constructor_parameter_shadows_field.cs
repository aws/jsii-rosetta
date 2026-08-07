class MyResource
{
    public string Env { get; }
    private readonly string resource;

    public MyResource(string resource)
    {
        this.resource = resource;
        Env = "production";
    }

    public string Description()
    {
        return resource;
    }
}

var r = new MyResource("bucket");
