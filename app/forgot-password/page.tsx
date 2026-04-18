"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { FiArrowLeft, FiMail } from "react-icons/fi";
import { createClient } from "@/shared/supabase/supabase-client";
import { getSupabaseSetupMessage, hasSupabasePublicEnv } from "@/shared/supabase/env";
import styles from "./forgot-password.module.css";

export default function ForgotPasswordPage() {
  const isSupabaseConfigured = useMemo(() => hasSupabasePublicEnv(), []);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [isSupabaseConfigured]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const supabaseSetupMessage = useMemo(() => getSupabaseSetupMessage(), []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setSuccess(false);
      setMessage("Unesite email adresu.");
      return;
    }

    if (!supabase) {
      setSuccess(false);
      setMessage(supabaseSetupMessage);
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setSuccess(false);

      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      setMessage(
        "Poslali smo vam email sa uputstvom za reset lozinke. Proverite inbox i spam folder."
      );
    } catch (error) {
      setSuccess(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Došlo je do greške pri slanju email-a za reset lozinke."
      );
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

        <div className={styles.kicker}>Reset lozinke</div>
        <h1 className={styles.title}>Zaboravili ste lozinku?</h1>
        <p className={styles.subtitle}>
          Unesite email adresu povezanu sa nalogom i poslaćemo vam link za
          promenu lozinke.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Email adresa</span>
            <div className={styles.inputWrap}>
              <FiMail className={styles.icon} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ime@email.com"
                className={styles.input}
                required
                disabled={loading}
              />
            </div>
          </label>

          <button type="submit" className={styles.primaryBtn} disabled={loading}>
            {loading ? "Šaljemo..." : "Pošalji link za reset"}
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
