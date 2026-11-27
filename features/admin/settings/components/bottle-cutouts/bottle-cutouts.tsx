"use client";

import { useEffect, useRef, useState } from "react";
import { PiArrowClockwise, PiImage, PiPlay, PiStop } from "react-icons/pi";
import ui from "@/features/admin/ui/admin-ui.module.css";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";
import styles from "./bottle-cutouts.module.css";

type Overview = { available: boolean; total: number; done: number; failed: number; remaining: number };
type BatchResult = {
  total: number;
  done: number;
  failedTotal: number;
  remaining: number;
  retryRemaining: number;
  next: string | null;
};

/**
 * Processing bottle images on the server once (background removal + liquid color), so visitors' phones
 * don't have to. New and changed perfumes are processed on save; this runs the existing ones in batches.
 */
export default function BottleCutouts({ isDemo }: { isDemo: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/perfumes/cutouts", { cache: "no-store" })
      .then(async (response) => {
        const data = (await readJsonSafe(response)) as Overview | null;
        if (active && response.ok && data) setOverview(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /** retry = the failed ones again, each once (the server returns a cursor in `next`). */
  async function run(retry = false) {
    setRunning(true);
    setError("");
    stopRef.current = false;
    let after = "";
    try {
      // One small batch per request (serverless time limit); repeat until nothing is left.
      while (!stopRef.current) {
        const response = await fetch("/api/admin/perfumes/cutouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(retry ? { limit: 6, retryFailed: true, after } : { limit: 6 }),
        });
        const data = (await readJsonSafe(response)) as BatchResult | null;
        if (!response.ok || !data) throw new Error(resolveErrorMessage(data, "Obrada nije uspela."));
        setOverview({ available: true, total: data.total, done: data.done, failed: data.failedTotal, remaining: data.remaining });
        if (retry) {
          if (!data.retryRemaining || !data.next) break;
          after = data.next;
        } else if (data.remaining === 0) {
          break;
        }
      }
    } catch (runError) {
      setError((runError as Error).message || "Obrada nije uspela.");
    } finally {
      setRunning(false);
    }
  }

  const percent = overview && overview.total ? Math.round(((overview.done + overview.failed) / overview.total) * 100) : 0;

  return (
    <section className={`${ui.panel} ${styles.panel}`}>
      <div className={ui.panelHead}>
        <div className={ui.panelTitleRow}>
          <span className={ui.panelIcon} aria-hidden="true">
            <PiImage />
          </span>
          <h2 className={ui.panelTitle}>Slike bočica</h2>
        </div>
      </div>

      <p className={styles.text}>
        Uklanjanje bele pozadine i boja tečnosti rade se jednom na serveru, umesto u telefonu svakog posetioca:
        kartice u šopu se pojavljuju odmah i troše manje baterije. Novi i izmenjeni parfemi se obrađuju sami pri
        čuvanju; ovde jednom obradiš postojeće.
      </p>

      {!overview ? (
        <p className={ui.hint}>Učitavanje…</p>
      ) : !overview.available ? (
        <p className={ui.hint}>Pokreni migraciju 017 u Supabase-u, pa osveži stranicu.</p>
      ) : (
        <>
          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span className={styles.bar} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.stats}>
            Obrađeno <strong>{overview.done}</strong> od {overview.total}
            {overview.failed > 0 && ` · ${overview.failed} nije moglo (te obrađuje pregledač kao ranije)`}
            {overview.remaining > 0 && ` · preostalo ${overview.remaining}`}
          </p>

          {error && <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div>}

          {isDemo ? (
            <p className={ui.hint}>Demo nalog ne može da pokrene obradu.</p>
          ) : running ? (
            <button type="button" className={ui.btn} onClick={() => (stopRef.current = true)}>
              <PiStop aria-hidden="true" /> Zaustavi
            </button>
          ) : overview.remaining > 0 ? (
            <button type="button" className={ui.btnPrimary} onClick={() => void run()}>
              <PiPlay aria-hidden="true" /> Obradi preostale slike
            </button>
          ) : overview.failed > 0 ? (
            <button type="button" className={ui.btn} onClick={() => void run(true)}>
              <PiArrowClockwise aria-hidden="true" /> Pokušaj ponovo neuspele ({overview.failed})
            </button>
          ) : (
            <p className={styles.done}>Sve slike su obrađene.</p>
          )}
          {running && <p className={ui.hint}>Ostavi stranicu otvorenu dok traje (oko sekunde po parfemu).</p>}
        </>
      )}
    </section>
  );
}
