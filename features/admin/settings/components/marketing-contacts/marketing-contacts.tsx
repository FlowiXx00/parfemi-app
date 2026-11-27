"use client";

import { useEffect, useState } from "react";
import { PiDownloadSimple, PiEnvelopeSimple } from "react-icons/pi";
import ui from "@/features/admin/ui/admin-ui.module.css";
import { readJsonSafe } from "@/lib/http";
import styles from "./marketing-contacts.module.css";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; count: number; available: boolean };

/** How many customers agreed to news and offers, and a CSV of them for an email tool. */
export default function MarketingContacts({ isDemo }: { isDemo: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/admin/marketing-contacts", { cache: "no-store" })
      .then(async (response) => {
        const data = (await readJsonSafe(response)) as { count?: number; available?: boolean } | null;
        if (!active) return;
        if (!response.ok || !data) return setState({ status: "error" });
        setState({ status: "ready", count: Number(data.count) || 0, available: data.available !== false });
      })
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className={`${ui.panel} ${styles.panel}`}>
      <div className={ui.panelHead}>
        <div className={ui.panelTitleRow}>
          <span className={ui.panelIcon} aria-hidden="true">
            <PiEnvelopeSimple />
          </span>
          <h2 className={ui.panelTitle}>Novosti i akcije</h2>
        </div>
      </div>

      {state.status === "loading" ? (
        <p className={ui.hint}>Učitavanje…</p>
      ) : state.status === "error" ? (
        <p className={ui.hint}>Broj pretplatnika trenutno nije dostupan.</p>
      ) : !state.available ? (
        <p className={ui.hint}>Pokreni migraciju 017 u Supabase-u da bi kupci mogli da se prijave na novosti.</p>
      ) : (
        <div className={styles.row}>
          <p className={styles.text}>
            <strong>{state.count}</strong>{" "}
            {state.count === 1 ? "kupac je pristao" : "kupaca je pristalo"} da dobija novosti i akcije (Podešavanja
            naloga → Obaveštenja). Šalji im samo to i ostavi u mejlu način za odjavu.
          </p>
          {isDemo ? (
            <span className={ui.hint}>Preuzimanje je isključeno za demo nalog.</span>
          ) : (
            <a className={ui.btn} href="/api/admin/marketing-contacts?format=csv" download>
              <PiDownloadSimple aria-hidden="true" /> Preuzmi CSV
            </a>
          )}
        </div>
      )}
    </section>
  );
}
