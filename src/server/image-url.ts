export function resolveImageUrl(value: string, base: URL): string {
  if (!value) return value;
  if (value.startsWith("/api/proxy/")) value = value.slice("/api/proxy".length);
  const root = base.href.replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(value)
        ? value
        : `${root}/${value.replace(/^\/+/, "")}`,
    );
  } catch {
    return "";
  }
  if (!["http:", "https:"].includes(url.protocol)) return "";
  return url.href;
}
