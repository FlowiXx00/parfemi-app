export function sanitizeNextPath(value: string | null | undefined) {
  const nextPath = (value ?? "").trim();

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  try {
    const url = new URL(nextPath, "https://atelierdekant.rs");
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}
