def normalize(value, fallback, retries):
    if not value:
        value = fallback
    if not fallback:
        value = "anonymous"
        retries = 3
    return value
