"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { createClient } from "@/db/clients/browser";
import { getSupabaseSetupMessage, hasSupabasePublicEnv } from "@/db/clients/env";
import {
  getPasswordChecks,
  getPasswordError,
  isPasswordStrong,
  translateAuthError,
} from "@/lib/password";
import styles from "./reset-password.module.css";

function getPasswordRules(password: string, confirmPassword: string) {
  return {
    ...getPasswordChecks(password),
    matches:
      confirmPassword.length > 0 &&
      password.length > 0 &&
      password === confirmPassword,
  };
}

export default function ResetPasswordPage() {
  const isSupabaseConfigured = useMemo(() => hasSupabasePublicEnv(), []);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [isSupabaseConfigured]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const supabaseSetupMessage = useMemo(() => getSupabaseSetupMessage(), []);

  const rules = getPasswordRules(password, confirmPassword);
  const isFormValid = isPasswordStrong(password) && rules.matches;

  useEffect(() => {
    let active = true;

    async function initRecoverySession() {
      if (!supabase) {
        setReady(false);
        setMessage(supabaseSetupMessage);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        setReady(true);
        setMessage("");
        return;
      }

      setReady(false);
      setMessage(
        "Link za reset lozinke nije validan ili je istekao. Zatražite novi email za reset."
      );
    }

    void initRecoverySession();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || Boolean(session)) {
        setReady(true);
        setMessage("");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, supabaseSetupMessage]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSuccess(false);

    if (!ready) {
      setMessage("Otvorite važeći link za reset lozinke iz email-a.");
      return;
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    if (!rules.matches) {
      setMessage("Lozinke se ne poklapaju.");
      return;
    }

    if (!supabase) {
      setMessage(supabaseSetupMessage);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      setMessage("Lozinka je uspešno promenjena. Sada se prijavite novom lozinkom.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setSuccess(false);
      setMessage(translateAuthError(error, "Došlo je do greške pri promeni lozinke."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/login" className={styles.backLink}>
          <FiArrowLeft />
          <span>Nazad na prijavu</span>
        </Link>

        <div className={styles.kicker}>Nova lozinka</div>
        <h1 className={styles.title}>Postavite novu lozinku</h1>
        <p className={styles.subtitle}>
          Nakon uspešnog reseta, koristite novu lozinku za prijavu na svoj nalog.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Nova lozinka</span>
            <div className={styles.inputWrap}>
              <FiLock className={styles.icon} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Unesite novu lozinku"
                className={styles.input}
                required
                disabled={loading || !ready}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                disabled={loading}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <label className={styles.field}>
            <span>Potvrda lozinke</span>
            <div className={styles.inputWrap}>
              <FiLock className={styles.icon} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ponovo unesite lozinku"
                className={styles.input}
                required
                disabled={loading || !ready}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                disabled={loading}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <div className={styles.rules}>
            <span className={rules.minLength ? styles.ruleOk : styles.rule}>Najmanje 8 karaktera</span>
            <span className={rules.hasLowercase ? styles.ruleOk : styles.rule}>Jedno malo slovo</span>
            <span className={rules.hasUppercase ? styles.ruleOk : styles.rule}>Jedno veliko slovo</span>
            <span className={rules.hasNumber ? styles.ruleOk : styles.rule}>Jedan broj</span>
            <span className={rules.hasSpecialChar ? styles.ruleOk : styles.rule}>Jedan specijalni znak</span>
            <span className={rules.matches ? styles.ruleOk : styles.rule}>Lozinke se poklapaju</span>
          </div>

          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={loading || !ready || !isFormValid}
          >
            {loading ? "Čuvamo..." : "Sačuvaj novu lozinku"}
          </button>

          {(message || !isSupabaseConfigured) && (
            <div className={`${styles.message} ${success ? styles.success : styles.error}`}>
              {message || supabaseSetupMessage}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
