public string Normalize(string value, string fallback, int retries)
{
    if (!value)
    {
        value = fallback;
    }
    if (!fallback)
    {
        value = "anonymous";
        retries = 3;
    }
    return value;
}
