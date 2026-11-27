"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPerfumesApiError,
  fetchAdminPerfumes,
  saveAdminRating,
} from "@/features/admin/perfumes/client/perfumes.api";
import type { PerfumeAdminRow } from "@/features/admin/perfumes/types";
import {
  ADMIN_WINDOW_NAME,
  buildBookmarklet,
  FRAGRANTICA_WINDOW_NAME,
  fragranticaSearchUrl,
  googleSearchUrl,
  isFragranticaOrigin,
  isWantRequest,
  parsePastedRating,
  parseReading,
  titleMatchScore,
  wantReply,
  type FragranticaReading,
} from "../../lib/fragrantica";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import ui from "@/features/admin/ui/admin-ui.module.css";
import styles from "./quick-ratings.module.css";

/** The best-known brands go first (customers look for them most). The rest alphabetically. */
const PRIORITY_BRANDS = [
  "Dior", "Chanel", "Creed", "Tom Ford", "Yves Saint Laurent", "Giorgio Armani", "Versace",
  "Parfums de Marly", "Maison Francis Kurkdjian", "Xerjoff", "Initio Parfums Privés", "Jean Paul Gaultier",
  "Paco Rabanne", "Prada", "Valentino", "Gucci", "Dolce&Gabbana", "Carolina Herrera", "Givenchy",
  "Hermès", "Louis Vuitton", "Kilian Paris", "Byredo", "Le Labo", "Amouage", "Nishane", "Lattafa",
  "Armaf", "Montale", "Mancera", "Viktor&Rolf", "Mugler", "Azzaro", "Burberry", "Lancôme",
];
const SKIP_KEY = "atelier-ocene-preskoceni";
const CHANNEL_NAME = "atelier-ocene";
/** Below this, the Fragrantica title is probably a different perfume -> ask for confirmation. */
const MATCH_THRESHOLD = 0.6;

type Saved = { id: string; label: string; rating: number; votes: number; prev: { rating: number | null; votes: number | null } };
type Pending = { perfume: PerfumeAdminRow; reading: FragranticaReading };

function readSkipped(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SKIP_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSkipped(ids: Set<string>) {
  try {
    window.localStorage.setItem(SKIP_KEY, JSON.stringify([...ids]));
  } catch {
    /* private window: skipping only lasts while the page is open */
  }
}

const brandRank = (brand: string) => {
  const index = PRIORITY_BRANDS.indexOf(brand);
  return index === -1 ? PRIORITY_BRANDS.length : index;
};

export default function QuickRatings() {
  const router = useRouter();
  const [list, setList] = useState<PerfumeAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState("");
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [autoOpen, setAutoOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [recent, setRecent] = useState<Saved[]>([]);
  const [manualRating, setManualRating] = useState("");
  const [manualVotes, setManualVotes] = useState("");
  const [paste, setPaste] = useState("");
  const bookmarkletRef = useRef<HTMLAnchorElement | null>(null);

  /* ---------------------------- loading ---------------------------- */

  useEffect(() => {
    // Window name: the bookmarklet targets it when there's no direct link to this tab.
    window.name = ADMIN_WINDOW_NAME;
    fetchAdminPerfumes()
      .then((rows) => {
        // Skipped items (localStorage) are read in the browser only, together with the list.
        setSkipped(readSkipped());
        setList(rows);
      })
      .catch((err: unknown) => {
        if (err instanceof AdminPerfumesApiError && err.status === 401) return router.replace("/login?next=/admin/ocene");
        if (err instanceof AdminPerfumesApiError && err.status === 403) return router.replace("/");
        setError((err as Error).message || "Greška pri učitavanju parfema.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  // React doesn't allow javascript: in href, so the button's link is set manually.
  useEffect(() => {
    bookmarkletRef.current?.setAttribute("href", buildBookmarklet(window.location.origin));
  }, [loading]);

  const brands = useMemo(
    () => [...new Set(list.filter((p) => p.rating === null).map((p) => p.brand))].sort((a, b) => a.localeCompare(b)),
    [list]
  );

  const queue = useMemo(
    () =>
      list
        .filter((p) => p.rating === null && p.is_active && !skipped.has(p.id) && (!brand || p.brand === brand))
        .sort((a, b) => brandRank(a.brand) - brandRank(b.brand) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)),
    [list, skipped, brand]
  );

  const current = queue[0] ?? null;
  const rated = list.filter((p) => p.rating !== null).length;

  /* ------------------------------ akcije ------------------------------ */

  const openSearch = useCallback((perfume: PerfumeAdminRow | null) => {
    if (!perfume) return;
    // No "noopener": this way the Fragrantica tab knows who opened it, so the button can post the rating
    // back.
    window.open(fragranticaSearchUrl(perfume.brand, perfume.name, perfume.concentration), FRAGRANTICA_WINDOW_NAME);
  }, []);

  const save = useCallback(
    async (perfume: PerfumeAdminRow, rating: number, votes: number) => {
      setSaving(true);
      setNotice("");
      try {
        await saveAdminRating(perfume.id, rating, votes);
        const prev = { rating: perfume.rating, votes: perfume.votes };
        const nextList = list.map((p) => (p.id === perfume.id ? { ...p, rating, votes } : p));
        setList(nextList);
        setRecent((items) => [{ id: perfume.id, label: `${perfume.brand} ${perfume.name}`, rating, votes, prev }, ...items].slice(0, 8));
        setPending(null);
        setManualRating("");
        setManualVotes("");
        setPaste("");
        setNotice(`✅ ${perfume.brand} ${perfume.name}: ${rating.toFixed(2)} (${votes.toLocaleString("sr-RS")} glasova)`);

        // Open the next perfume in the queue on Fragrantica right away (same tab).
        if (autoOpen) {
          const next = nextList
            .filter((p) => p.rating === null && p.is_active && !skipped.has(p.id) && (!brand || p.brand === brand))
            .sort((a, b) => brandRank(a.brand) - brandRank(b.brand) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))[0];
          openSearch(next ?? null);
        }
      } catch (err) {
        setNotice(`⚠️ ${(err as Error).message || "Čuvanje nije uspelo."}`);
      } finally {
        setSaving(false);
      }
    },
    [autoOpen, brand, list, openSearch, skipped]
  );

  /** Rating arrived from Fragrantica: if the title matches, save right away, otherwise ask for confirmation. */
  const receive = useCallback(
    (reading: FragranticaReading) => {
      if (!current) {
        setNotice("⚠️ Stigla je ocena, ali nema parfema u redu.");
        return;
      }
      const score = titleMatchScore(current.brand, current.name, reading.title);
      if (score >= MATCH_THRESHOLD) {
        void save(current, reading.rating, reading.votes);
      } else {
        setPending({ perfume: current, reading });
        setNotice("");
      }
    },
    [current, save]
  );

  // Message from the Fragrantica tab (postMessage), accepted only from Fragrantica domains:
  // either "which perfume is next?" (search page) or a rating.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isFragranticaOrigin(event.origin)) return;
      if (isWantRequest(event.data)) {
        if (current) (event.source as Window | null)?.postMessage(wantReply(current), event.origin);
        return;
      }
      const reading = parseReading(event.data);
      if (reading) receive(reading);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [current, receive]);

  // Link between admin tabs (same site): if the button opens a NEW admin tab, it forwards the rating to
  // the tab you're already working in and closes, so tabs don't pile up.
  const receiveRef = useRef(receive);
  useEffect(() => {
    receiveRef.current = receive;
  }, [receive]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { kind?: string; reading?: unknown } | null;
      if (data?.kind === "ping") channel.postMessage({ kind: "pong" });
      if (data?.kind === "reading") {
        const reading = parseReading(data.reading);
        if (reading) receiveRef.current(reading);
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Fallback path: the button opens this page with the data in "#fr=…".
  useEffect(() => {
    if (loading) return;
    const forwardToOtherTab = (reading: FragranticaReading) =>
      new Promise<boolean>((resolve) => {
        const channel = channelRef.current;
        if (!channel) return resolve(false);
        let done = false;
        const onPong = (event: MessageEvent) => {
          if ((event.data as { kind?: string } | null)?.kind !== "pong" || done) return;
          done = true;
          channel.postMessage({ kind: "reading", reading });
          resolve(true);
        };
        channel.addEventListener("message", onPong);
        channel.postMessage({ kind: "ping" });
        window.setTimeout(() => {
          channel.removeEventListener("message", onPong);
          if (!done) {
            done = true;
            resolve(false);
          }
        }, 400);
      });

    const readHash = async () => {
      const match = window.location.hash.match(/^#fr=(.+)$/);
      if (!match) return;
      history.replaceState(null, "", window.location.pathname);
      let reading: FragranticaReading | null = null;
      try {
        reading = parseReading(JSON.parse(decodeURIComponent(match[1]!)));
      } catch {
        /* neispravni podaci */
      }
      if (!reading) {
        setNotice("⚠️ Podaci sa Fragrantice nisu ispravni.");
        return;
      }
      if (await forwardToOtherTab(reading)) {
        setNotice("✅ Ocena je poslata u admin tab u kom radiš — ovaj tab možeš zatvoriti.");
        window.close();
        return;
      }
      receiveRef.current(reading);
    };
    void readHash();
    const onHashChange = () => void readHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [loading]);

  function skip() {
    if (!current) return;
    const next = new Set(skipped).add(current.id);
    setSkipped(next);
    writeSkipped(next);
    setPending(null);
    setNotice(`⏭ Preskočeno: ${current.brand} ${current.name}`);
    if (autoOpen) openSearch(queue[1] ?? null);
  }

  function restoreSkipped() {
    setSkipped(new Set());
    writeSkipped(new Set());
  }

  async function undo(item: Saved) {
    try {
      await saveAdminRating(item.id, item.prev.rating, item.prev.votes);
      setList((rows) => rows.map((p) => (p.id === item.id ? { ...p, rating: item.prev.rating, votes: item.prev.votes } : p)));
      setRecent((items) => items.filter((entry) => entry !== item));
      setNotice(`↩ Poništeno: ${item.label}`);
    } catch (err) {
      setNotice(`⚠️ ${(err as Error).message}`);
    }
  }

  function saveManual() {
    if (!current) return;
    const fromPaste = paste.trim() ? parsePastedRating(paste) : null;
    const rating = fromPaste?.rating ?? Number(manualRating.replace(",", "."));
    const votes = fromPaste?.votes ?? Number(manualVotes.replace(/[^\d]/g, ""));
    if (!(rating >= 1 && rating <= 5)) {
      setNotice("⚠️ Ocena mora biti između 1 i 5 (npr. 4.31).");
      return;
    }
    void save(current, rating, Number.isFinite(votes) ? votes : 0);
  }

  /* ------------------------------ prikaz ------------------------------ */

  const header = (
    <AdminPageHeader
      title="Fragrantica ocene"
      subtitle="Brzi unos ocena koje kupci vide na parfemima — ti otvaraš Fragranticu, dugme samo prepiše dva broja."
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <div className={ui.loading}>Učitavanje parfema…</div>
      </>
    );
  }
  if (error) {
    return (
      <>
        {header}
        <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div>
      </>
    );
  }

  const progress = list.length ? Math.round((rated / list.length) * 100) : 0;

  return (
    <div className={styles.page}>
      {header}

      <section className={`${ui.panel} ${styles.head}`}>
        <div className={styles.headStats}>
          <div>
            <span>Sa ocenom</span>
            <strong>
              {rated} <small>/ {list.length}</small>
            </strong>
          </div>
          <div>
            <span>U redu još</span>
            <strong>{queue.length}</strong>
          </div>
          <div>
            <span>Pokrivenost</span>
            <strong>{progress}%</strong>
          </div>
        </div>
        <div className={styles.progress} aria-label={`${progress}% parfema ima ocenu`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      {/* -------- One time: button for the bookmarks bar -------- */}
      <details className={styles.setup} open={recent.length === 0}>
        <summary>Kako radi (podešavanje jednom, 10 sekundi)</summary>
        <ol>
          <li>
            Uključi traku za obeleživače: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>.
          </li>
          <li>
            <strong>Prevuci</strong> ovo dugme mišem na traku:{" "}
            <a
              ref={bookmarkletRef}
              className={styles.bookmarklet}
              onClick={(event) => {
                event.preventDefault();
                setNotice("ℹ️ Ovo dugme se ne klikće ovde — prevuci ga na traku za obeleživače.");
              }}
              draggable
            >
              ⭐ Pošalji ocenu
            </a>
          </li>
          <li>
            Klikni <strong>„Traži na Fragrantici”</strong>, sačekaj rezultate i klikni <strong>⭐ Pošalji ocenu</strong>{" "}
            na traci. Dugme samo nađe tačan parfem, ocena se sačuva ovde i odmah se otvara sledeći. Jedan klik po
            parfemu.
          </li>
          <li>
            Ako dugme nije sigurno koja je verzija, otvori pravi parfem iz rezultata i klikni{" "}
            <strong>⭐ Pošalji ocenu</strong> na njegovoj strani.
          </li>
        </ol>
        <p className={styles.hint}>
          Ako si dugme dodao ranije, obriši staro i prevuci ovo novo. Ako se ocena ne poklapa sa nazivom (npr.
          „Intense”), ovde ćeš dobiti upozorenje pre čuvanja.
        </p>
      </details>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span>Brend</span>
          <select value={brand} onChange={(event) => setBrand(event.target.value)}>
            <option value="">Svi (poznati brendovi prvi)</option>
            {brands.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={autoOpen} onChange={(event) => setAutoOpen(event.target.checked)} />
          <span>Posle čuvanja odmah otvori sledeći na Fragrantici</span>
        </label>
        {skipped.size > 0 && (
          <button type="button" className={styles.linkBtn} onClick={restoreSkipped}>
            Vrati preskočene ({skipped.size})
          </button>
        )}
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}

      {/* -------- Wrong perfume? -------- */}
      {pending && (
        <div className={styles.warn} role="alert">
          <strong>Proveri parfem:</strong> na Fragrantici je otvoren „{pending.reading.title || "nepoznato"}”, a u redu je{" "}
          „{pending.perfume.brand} {pending.perfume.name}” ({pending.perfume.concentration}).
          <div className={styles.warnActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={saving}
              onClick={() => void save(pending.perfume, pending.reading.rating, pending.reading.votes)}
            >
              Ipak sačuvaj {pending.reading.rating.toFixed(2)} ({pending.reading.votes.toLocaleString("sr-RS")})
            </button>
            <button type="button" className={styles.btn} onClick={() => setPending(null)}>
              Odbaci
            </button>
          </div>
        </div>
      )}

      {/* -------- Trenutni parfem -------- */}
      {current ? (
        <section className={styles.current}>
          <div className={styles.thumb}>
            {current.images[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.images[0].url} alt="" />
            ) : (
              <span>bez slike</span>
            )}
          </div>

          <div className={styles.info}>
            <span className={styles.brand}>{current.brand}</span>
            <strong className={styles.name}>{current.name}</strong>
            <span className={styles.meta}>
              {current.concentration} · {current.gender}
            </span>

            <div className={styles.actions}>
              <button type="button" className={styles.btnPrimary} onClick={() => openSearch(current)}>
                🔍 Traži na Fragrantici
              </button>
              <a
                className={styles.btn}
                href={googleSearchUrl(current.brand, current.name)}
                target={FRAGRANTICA_WINDOW_NAME}
              >
                Google ↗
              </a>
              <button type="button" className={styles.btn} onClick={skip}>
                Preskoči
              </button>
            </div>

            <div className={styles.waiting}>
              {saving ? "Čuvam…" : "Čekam ocenu sa Fragrantice (dugme ⭐ Pošalji ocenu)…"}
            </div>

            <div className={styles.manual}>
              <span className={styles.manualLabel}>Ili ručno:</span>
              <input
                inputMode="decimal"
                placeholder="ocena, npr. 4.31"
                value={manualRating}
                onChange={(event) => setManualRating(event.target.value)}
              />
              <input
                inputMode="numeric"
                placeholder="glasova, npr. 29185"
                value={manualVotes}
                onChange={(event) => setManualVotes(event.target.value)}
              />
              <input
                className={styles.paste}
                placeholder="…ili nalepi: Perfume rating 4.31 out of 5 with 29,185 votes"
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && saveManual()}
              />
              <button type="button" className={styles.btn} disabled={saving} onClick={saveManual}>
                Sačuvaj
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className={styles.done}>
          🎉 Nema više parfema bez ocene{brand ? ` za ${brand}` : ""}
          {skipped.size > 0 ? ` (preskočeno: ${skipped.size})` : ""}.
        </div>
      )}

      {/* -------- Recently saved -------- */}
      {recent.length > 0 && (
        <section className={styles.recent}>
          <h2>Upravo sačuvano</h2>
          <ul>
            {recent.map((item) => (
              <li key={`${item.id}-${item.rating}-${item.votes}`}>
                <span>
                  {item.label} — <strong>{item.rating.toFixed(2)}</strong> ({item.votes.toLocaleString("sr-RS")})
                </span>
                <button type="button" className={styles.linkBtn} onClick={() => void undo(item)}>
                  Poništi
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
