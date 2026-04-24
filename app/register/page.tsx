"use client";

import type React from "react";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeNextPath } from "@/shared/lib/safe-next";
import { FiEye, FiEyeOff, FiLock, FiMail, FiUser } from "react-icons/fi";
import { createClient } from "@/shared/supabase/supabase-client";
import { getSupabaseSetupMessage, hasSupabasePublicEnv } from "@/shared/supabase/env";
import styles from "./register.module.css";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSupabaseConfigured = useMemo(() => hasSupabasePublicEnv(), []);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [isSupabaseConfigured]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const supabaseSetupMessage = useMemo(() => getSupabaseSetupMessage(), []);

  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams]);

  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[^A-Za-z0-9]/.test(password),
      matches:
        confirmPassword.length > 0 &&
        password.length > 0 &&
        password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const hasCorePasswordRules =
    passwordChecks.hasLetter &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasNumber;

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    isEmailValid &&
    passwordChecks.minLength &&
    hasCorePasswordRules &&
    passwordChecks.hasSpecialChar &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  async function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setSuccessMsg("");

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
      setMsg("Popuni sva obavezna polja.");
      return;
    }

    if (!isEmailValid) {
      setMsg("Unesi ispravnu email adresu.");
      return;
    }

    if (!passwordChecks.minLength) {
      setMsg("Lozinka mora imati najmanje 8 karaktera.");
      return;
    }

    if (!passwordChecks.hasUppercase) {
      setMsg("Lozinka mora sadržati bar jedno veliko slovo.");
      return;
    }

    if (!passwordChecks.hasNumber) {
      setMsg("Lozinka mora sadržati bar jedan broj.");
      return;
    }

    if (!passwordChecks.hasSpecialChar) {
      setMsg("Lozinka mora sadržati bar jedan specijalni znak.");
      return;
    }

    if (password !== confirmPassword) {
      setMsg("Lozinke se ne poklapaju.");
      return;
    }

    if (!supabase) {
      setMsg(supabaseSetupMessage);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            given_name: cleanFirstName,
            family_name: cleanLastName,
            avatar_url: null,
          },
        },
      });

      setLoading(false);

      if (error) {
        const lowerMessage = error.message.toLowerCase();

        if (lowerMessage.includes("already registered")) {
          setMsg("Za ovu email adresu već postoji nalog. Pokušaj prijavu ili reset lozinke.");
          return;
        }

        setMsg(error.message);
        return;
      }

      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      if (!data.session) {
        setSuccessMsg(
          "Ako je registracija prihvaćena, stići će ti email za potvrdu naloga. Nakon potvrde možeš da se prijaviš."
        );
        return;
      }

      router.refresh();
      router.replace(nextPath);
    } catch {
      setLoading(false);
      setMsg("Došlo je do greške. Pokušaj ponovo.");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgGlowTop} aria-hidden="true" />
      <div className={styles.bgGlowBottom} aria-hidden="true" />
      <div className={styles.blobLeft} aria-hidden="true" />
      <div className={styles.blobRight} aria-hidden="true" />
      <div className={styles.blobBottom} aria-hidden="true" />

      <section className={styles.card}>
        <div className={styles.brand}>Atelier Dekant</div>

        <h1 className={styles.title}>Registracija</h1>
        <p className={styles.subtitle}>
          Kreiraj nalog i nastavi kupovinu dekanta parfema.
        </p>

        <form onSubmit={onRegister} className={styles.form}>
          <div className={styles.doubleField}>
            <div className={styles.field}>
              <label htmlFor="firstName" className={styles.label}>
                Ime
              </label>

              <div className={styles.inputWrap}>
                <FiUser className={styles.inputIcon} />
                <input
                  id="firstName"
                  type="text"
                  placeholder="Unesi ime"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  className={styles.input}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="lastName" className={styles.label}>
                Prezime
              </label>

              <div className={styles.inputWrap}>
                <FiUser className={styles.inputIcon} />
                <input
                  id="lastName"
                  type="text"
                  placeholder="Unesi prezime"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  autoCapitalize="words"
                  className={styles.input}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>

            <div className={styles.inputWrap}>
              <FiMail className={styles.inputIcon} />
              <input
                id="email"
                type="email"
                placeholder="Unesi email adresu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={styles.input}
                disabled={loading}
                required
              />
            </div>

            <div className={`${styles.emailHint} ${styles.emailHintChecking}`}>
              Provera email adrese se radi tokom bezbedne registracije.
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Lozinka
            </label>

            <div className={styles.inputWrap}>
              <FiLock className={styles.inputIcon} />

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Unesi lozinku"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
                required
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                title={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                disabled={loading}
              >
                {showPassword ? (
                  <FiEyeOff className={styles.passwordToggleIcon} />
                ) : (
                  <FiEye className={styles.passwordToggleIcon} />
                )}
              </button>
            </div>

            <div className={styles.rules}>
              <div
                className={`${styles.rule} ${
                  passwordChecks.minLength ? styles.ruleOk : ""
                }`}
              >
                {passwordChecks.minLength ? "✓" : "•"} Najmanje 8 karaktera
              </div>

              <div
                className={`${styles.rule} ${
                  hasCorePasswordRules ? styles.ruleOk : ""
                }`}
              >
                {hasCorePasswordRules ? "✓" : "•"} Sadrži slovo, veliko slovo i broj
              </div>

              <div
                className={`${styles.rule} ${
                  passwordChecks.hasSpecialChar ? styles.ruleOk : ""
                }`}
              >
                {passwordChecks.hasSpecialChar ? "✓" : "•"} Sadrži specijalni znak @ # $
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Potvrdi lozinku
            </label>

            <div className={styles.inputWrap}>
              <FiLock className={styles.inputIcon} />

              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Ponovo unesi lozinku"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
                required
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"
                }
                title={
                  showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"
                }
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <FiEyeOff className={styles.passwordToggleIcon} />
                ) : (
                  <FiEye className={styles.passwordToggleIcon} />
                )}
              </button>
            </div>

            {confirmPassword.length > 0 && (
              <div
                className={`${styles.rule} ${
                  passwordChecks.matches ? styles.ruleOk : ""
                }`}
              >
                {passwordChecks.matches ? "✓" : "•"} Lozinke se poklapaju
              </div>
            )}
          </div>

          {msg || !isSupabaseConfigured ? <div className={styles.error}>{msg || supabaseSetupMessage}</div> : null}
          {successMsg ? <div className={styles.success}>{successMsg}</div> : null}

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={styles.submitBtn}
          >
            {loading ? (
              <span className={styles.submitContent}>
                <span className={styles.spinner} aria-hidden="true" />
                Kreiram nalog...
              </span>
            ) : (
              "Kreiraj nalog"
            )}
          </button>
        </form>

        <div className={styles.footerText}>
          Već imaš nalog?{" "}
          <Link
            href={
              nextPath === "/"
                ? "/login"
                : `/login?next=${encodeURIComponent(nextPath)}`
            }
            className={styles.footerLink}
          >
            Prijavi se
          </Link>
        </div>
      </section>
    </div>
  );
}
