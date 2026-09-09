class MyResource {
  public readonly env: string;
  private readonly resource: string;

  constructor(resource: string) {
    this.resource = resource;
    this.env = 'production';
  }

  public description(): string {
    return this.resource;
  }
}

const r = new MyResource('bucket');
