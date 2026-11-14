public class LocalProps {
    private String[] headers;
    public String[] getHeaders() {
        return this.headers;
    }
    public LocalProps headers(String[] headers) {
        this.headers = headers;
        return this;
    }
}

LocalProps localProps = new LocalProps().headers(List.of("H"));
