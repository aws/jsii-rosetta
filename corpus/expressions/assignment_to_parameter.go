func normalize(value *string, fallback *string, retries *f64) *string {
	if !*value {
		*value = *fallback
	}
	if !*fallback {
		*value = "anonymous"
		*retries = 3
	}
	return *value
}
