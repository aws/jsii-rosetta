public String normalize(String value, String fallback, Number retries) {
    if (!value) {
        value = fallback;
    }
    if (!fallback) {
        value = "anonymous";
        retries = 3;
    }
    return value;
}
