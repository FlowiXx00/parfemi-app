"use client";

import type React from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeNextPath } from "@/shared/lib/safe-next";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { createClient } from "@/shared/supabase/supabase-client";
import { getSupabaseSetupMessage, hasSupabasePublicEnv } from "@/shared/supabase/env";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSupabaseConfigured = useMemo(() => hasSupabasePublicEnv(), []);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [isSupabaseConfigured]);
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [oauthHashMessage, setOauthHashMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const supabaseSetupMessage = useMemo(() => getSupabaseSetupMessage(), []);

  const queryErrorMessage = useMemo(() => {
    const qError = searchParams.get("error");

    if (qError === "oauth_callback_failed") {
      return "Google prijava nije uspela. Pokušaj ponovo.";
    }

    if (qError === "supabase_not_configured") {
      return supabaseSetupMessage;
    }

    return "";
  }, [searchParams, supabaseSetupMessage]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const error = hashParams.get("error");
    const errorCode = hashParams.get("error_code");
    const errorDescription = hashParams.get("error_description");

    if (!error && !errorDescription) return;

    const nextMessage = `OAuth greška: ${errorCode || error || "unknown"} - ${
      errorDescription || "Nema opisa"
    }`;

    const timer = window.setTimeout(() => {
      setOauthHashMessage(nextMessage);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const feedbackMessage = message || oauthHashMessage || queryErrorMessage;

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const isFormValid = useMemo(() => {
    return (
      email.trim().length > 0 &&
      isEmailValid &&
      password.trim().length > 0
    );
  }, [email, password, isEmailValid]);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("Unesi email i lozinku.");
      return;
    }

    if (!isEmailValid) {
      setMessage("Unesi ispravnu email adresu.");
      return;
    }

    if (!supabase) {
      setMessage(supabaseSetupMessage);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setLoading(false);

    if (error) {
      const lowerMsg = error.message.toLowerCase();

      if (
        lowerMsg.includes("invalid login credentials") ||
        lowerMsg.includes("invalid credentials")
      ) {
        setMessage("Pogrešan email ili lozinka.");
        return;
      }

      setMessage(error.message);
      return;
    }

    router.refresh();
    router.replace(nextPath);
  }

  async function onGoogleLogin() {
    setMessage("");
    setOauthHashMessage("");

    if (!supabase) {
      setMessage(supabaseSetupMessage);
      return;
    }

    setLoading(true);

    const origin = window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
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

        <h1 className={styles.title}>Prijava</h1>
        <p className={styles.subtitle}>
          Prijavi se i nastavi kupovinu dekanta parfema.
        </p>

        <form onSubmit={onLogin} className={styles.form}>
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
                autoComplete="current-password"
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
          </div>

          <div className={styles.topRow}>
            <Link
              href={
                nextPath === "/"
                  ? "/forgot-password"
                  : `/forgot-password?next=${encodeURIComponent(nextPath)}`
              }
              className={styles.forgotLink}
            >
              Zaboravili ste lozinku?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={styles.submitBtn}
          >
            {loading ? (
              <span className={styles.submitContent}>
                <span className={styles.spinner} aria-hidden="true" />
                Prijavljujem...
              </span>
            ) : (
              "Prijavi se"
            )}
          </button>

          <div className={styles.divider}>
            <span>Ili nastavi preko</span>
          </div>

          <div className={styles.socialRow}>
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loading}
              title="Login with Google"
              className={styles.googleBtn}
            >
              <FcGoogle size={24} />
              <span>Google</span>
            </button>
          </div>

          <div className={styles.registerBox}>
            <span className={styles.registerText}>Nemaš nalog?</span>
            <Link
              href={
                nextPath === "/" ? "/register" : `/register?next=${encodeURIComponent(nextPath)}`
              }
              className={styles.registerLink}
            >
              Registruj se
            </Link>
          </div>

          {(feedbackMessage || !isSupabaseConfigured) && <div className={styles.message}>{feedbackMessage || supabaseSetupMessage}</div>}
        </form>
      </section>
    </div>
  );
}
