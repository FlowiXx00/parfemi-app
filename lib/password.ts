/**
 * Password rules, the SAME as in the Supabase settings
 * (Authentication -> Email: minimum 8, "Lowercase, uppercase letters, digits and symbols").
 * If you change the rules in Supabase, change them here too.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordChecks = {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
};

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordStrong(password: string) {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}

/** First password problem as a Serbian message, or null if the password is valid. */
export function getPasswordError(password: string): string | null {
  const checks = getPasswordChecks(password);

  if (!checks.minLength) return `Lozinka mora imati najmanje ${PASSWORD_MIN_LENGTH} karaktera.`;
  if (!checks.hasLowercase) return "Lozinka mora sadržati bar jedno malo slovo.";
  if (!checks.hasUppercase) return "Lozinka mora sadržati bar jedno veliko slovo.";
  if (!checks.hasNumber) return "Lozinka mora sadržati bar jedan broj.";
  if (!checks.hasSpecialChar) return "Lozinka mora sadržati bar jedan specijalni znak.";

  return null;
}

/** Supabase Auth errors (in English) -> user-facing message in Serbian. */
export function translateAuthError(error: unknown, fallback = "Došlo je do greške. Pokušaj ponovo.") {
  if (!(error instanceof Error)) return fallback;

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error.message.toLowerCase();

  if (code === "weak_password" || message.includes("password should")) {
    return `Lozinka nije dovoljno jaka: najmanje ${PASSWORD_MIN_LENGTH} karaktera, malo i veliko slovo, broj i specijalni znak.`;
  }

  if (code === "same_password" || message.includes("should be different")) {
    return "Nova lozinka mora biti drugačija od trenutne.";
  }

  if (message.includes("current password")) {
    return message.includes("required")
      ? "Unesi trenutnu lozinku."
      : "Trenutna lozinka nije ispravna.";
  }

  if (code === "reauthentication_needed" || message.includes("reauthentication")) {
    return "Iz bezbednosnih razloga odjavi se, prijavi ponovo, pa promeni lozinku.";
  }

  if (message.includes("already registered") || code === "user_already_exists") {
    return "Za ovu email adresu već postoji nalog. Pokušaj prijavu ili reset lozinke.";
  }

  if (code === "over_request_rate_limit" || message.includes("rate limit")) {
    return "Previše pokušaja. Sačekaj malo pa pokušaj ponovo.";
  }

  return error.message || fallback;
}
