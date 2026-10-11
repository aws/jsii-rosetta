function normalize(value: string, fallback: string, retries: number): string {
  if (!value) {
    value = fallback;
  }
  if (!fallback) {
    value = 'anonymous';
    retries = 3;
  }
  return value;
}
