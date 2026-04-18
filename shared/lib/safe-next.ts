export function sanitizeNextPath(value: string | null | undefined) {
  const nextPath = (value ?? "").trim();

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  try {
    const url = new URL(nextPath, "http://192.168.0.28:3000");
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}
