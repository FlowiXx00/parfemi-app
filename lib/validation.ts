/** Validation and sanitizing of API route input. */

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** String -> trimovan string, sve ostalo -> "". */
export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
