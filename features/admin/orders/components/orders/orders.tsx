"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PiCopy, PiEnvelopeSimple, PiMagnifyingGlass, PiPhone, PiX } from "react-icons/pi";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import StatusBadge from "@/features/admin/ui/status-badge";
import ui from "@/features/admin/ui/admin-ui.module.css";
import { formatDate, formatRsd } from "../../lib/orders.lib";
import type { AdminOrderNextStatus, OrderRow, OrderStatus } from "../../types";
import { AdminOrdersApiError, loadOrders, updateOrderStatusRequest } from "../../client/orders.api";
import styles from "./orders.module.css";

type Tab = "all" | OrderStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Sve" },
  { key: "pending", label: "Nove" },
  { key: "confirmed", label: "Potvrđene" },
  { key: "shipped", label: "Poslate" },
  { key: "received", label: "Preuzete" },
  { key: "cancelled", label: "Otkazane" },
];

/** Next step for an order (primary button in the table and in the details). */
const NEXT_STEP: Partial<Record<OrderStatus, { status: AdminOrderNextStatus; label: string }>> = {
  pending: { status: "confirmed", label: "Potvrdi" },
  confirmed: { status: "shipped", label: "Označi kao poslato" },
};

const STATUS_HELP: Record<OrderStatus, string> = {
  pending: "Nova porudžbina — proveri dostupnost i potvrdi je.",
  confirmed: "Potvrđena — pripremi dekante i pošalji.",
  shipped: "Poslata — čeka da kupac potvrdi prijem.",
  received: "Kupac je potvrdio da je preuzeo pošiljku.",
  cancelled: "Otkazana — ml su vraćeni na zalihe (ako se prate).",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [copied, setCopied] = useState("");

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof AdminOrdersApiError && err.status === 401) return router.replace("/login?next=/admin/orders"), true;
      if (err instanceof AdminOrdersApiError && err.status === 403) return router.replace("/"), true;
      return false;
    },
    [router]
  );

  const refresh = useCallback(async () => {
    try {
      setOrders(await loadOrders("all", query));
      setError("");
    } catch (err) {
      if (handleApiError(err)) return;
      setError((err as Error).message || "Greška pri učitavanju porudžbina.");
    }
  }, [handleApiError, query]);

  // Loading (debounced while typing a search).
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh().finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  // "/admin/orders?open=12" (sa dashboarda) -> odmah otvori detalje.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    if (!Number.isFinite(id) || id <= 0) return;
    const timeout = window.setTimeout(() => setOpenId(id), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (openId === null) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const counts = useMemo(() => {
    const result: Record<Tab, number> = { all: orders.length, pending: 0, confirmed: 0, shipped: 0, received: 0, cancelled: 0 };
    for (const order of orders) result[order.status] += 1;
    return result;
  }, [orders]);

  const visible = useMemo(() => (tab === "all" ? orders : orders.filter((order) => order.status === tab)), [orders, tab]);
  const opened = orders.find((order) => order.id === openId) ?? null;

  async function updateStatus(order: OrderRow, next: AdminOrderNextStatus) {
    if (next === "cancelled" && !confirm(`Otkazati porudžbinu #${order.order_number}? Kupac dobija mejl (ako je podešen).`)) return;
    setBusyId(order.id);
    try {
      await updateOrderStatusRequest(order.id, next);
      await refresh();
      router.refresh(); // refresh the pending-orders count in the sidebar
    } catch (err) {
      if (handleApiError(err)) return;
      alert((err as Error).message || "Greška pri promeni statusa.");
    } finally {
      setBusyId(null);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard nije dostupan */
    }
  }

  return (
    <div className={styles.page}>
      <AdminPageHeader
        title="Porudžbine"
        subtitle="Klikni porudžbinu za detalje. Kupac dobija mejl pri svakoj promeni statusa (ako je mejl podešen)."
      />

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Status porudžbine">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`${styles.tab} ${tab === item.key ? styles.tabActive : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              <span className={styles.tabCount}>{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <PiMagnifyingGlass aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Broj porudžbine, npr. AD-611975"
            aria-label="Pretraga po broju porudžbine"
          />
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={`${ui.panel} ${styles.tablePanel}`}>
        {loading ? (
          <p className={styles.empty}>Učitavanje porudžbina…</p>
        ) : visible.length === 0 ? (
          <p className={styles.empty}>{query ? "Nema porudžbine sa tim brojem." : "Nema porudžbina u ovoj grupi."}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Porudžbina</th>
                <th>Kupac</th>
                <th>Datum</th>
                <th className={styles.num}>Iznos</th>
                <th>Status</th>
                <th aria-label="Akcija" />
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => {
                const next = NEXT_STEP[order.status];
                const items = order.order_items?.reduce((sum, item) => sum + item.qty, 0) ?? 0;
                return (
                  <tr key={order.id} className={openId === order.id ? styles.rowOpen : ""} onClick={() => setOpenId(order.id)}>
                    <td data-label="Porudžbina">
                      <button type="button" className={styles.rowLink} onClick={() => setOpenId(order.id)}>
                        #{order.order_number}
                      </button>
                      <small className={styles.sub}>{items} {items === 1 ? "stavka" : "stavki"}</small>
                    </td>
                    <td data-label="Kupac">
                      <strong className={styles.name}>{order.customer_full_name}</strong>
                      <small className={styles.sub}>{order.customer_city}</small>
                    </td>
                    <td data-label="Datum" className={styles.date}>
                      {formatDate(order.created_at)}
                    </td>
                    <td data-label="Iznos" className={styles.num}>
                      <strong>{formatRsd(order.total_rsd)}</strong>
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
                      {next && (
                        <button
                          type="button"
                          className={ui.btnPrimary}
                          disabled={busyId === order.id}
                          onClick={() => void updateStatus(order, next.status)}
                        >
                          {busyId === order.id ? "…" : next.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Order details (right-hand drawer) ---------- */}
      {opened && (
        <>
          <button type="button" className={styles.scrim} aria-label="Zatvori detalje" onClick={() => setOpenId(null)} />
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="order-title">
            <header className={styles.drawerHead}>
              <div>
                <h2 id="order-title" className={styles.drawerTitle}>
                  #{opened.order_number}
                </h2>
                <span className={styles.sub}>{formatDate(opened.created_at)}</span>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpenId(null)} aria-label="Zatvori">
                <PiX />
              </button>
            </header>

            <div className={styles.drawerBody}>
              <div className={styles.statusBox}>
                <StatusBadge status={opened.status} />
                <p>{STATUS_HELP[opened.status]}</p>
              </div>

              <section className={styles.block}>
                <h3>Kupac</h3>
                <p className={styles.customerName}>{opened.customer_full_name}</p>
                <p>
                  {opened.customer_address}, {opened.customer_city}
                </p>
                <div className={styles.contactRow}>
                  <a href={`tel:${opened.customer_phone}`} className={ui.btn}>
                    <PiPhone aria-hidden="true" /> {opened.customer_phone}
                  </a>
                  <a href={`mailto:${opened.customer_email}`} className={ui.btn}>
                    <PiEnvelopeSimple aria-hidden="true" /> Mejl
                  </a>
                  <button
                    type="button"
                    className={ui.btn}
                    onClick={() =>
                      void copy(
                        `${opened.customer_full_name}\n${opened.customer_address}\n${opened.customer_city}\n${opened.customer_phone}`,
                        "adresa"
                      )
                    }
                  >
                    <PiCopy aria-hidden="true" /> {copied === "adresa" ? "Kopirano ✓" : "Kopiraj adresu"}
                  </button>
                </div>
                {opened.customer_note?.trim() && <p className={styles.note}>„{opened.customer_note}”</p>}
              </section>

              <section className={styles.block}>
                <h3>Stavke</h3>
                <ul className={styles.items}>
                  {(opened.order_items ?? []).map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.perfume_name}</strong>
                        <small>
                          {item.ml} ml × {item.qty}
                        </small>
                      </span>
                      <span className={styles.num}>{formatRsd(item.line_total_rsd)}</span>
                    </li>
                  ))}
                </ul>
                <dl className={styles.totals}>
                  <div>
                    <dt>Proizvodi</dt>
                    <dd>{formatRsd(opened.subtotal_rsd)}</dd>
                  </div>
                  {opened.discount_rsd > 0 && (
                    <div>
                      <dt>Popust{opened.coupon_code ? ` (${opened.coupon_code})` : ""}</dt>
                      <dd>−{formatRsd(opened.discount_rsd)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Dostava</dt>
                    <dd>{opened.shipping_rsd > 0 ? formatRsd(opened.shipping_rsd) : "besplatno"}</dd>
                  </div>
                  <div className={styles.total}>
                    <dt>Ukupno</dt>
                    <dd>{formatRsd(opened.total_rsd)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            {(NEXT_STEP[opened.status] || opened.status === "pending" || opened.status === "confirmed") && (
              <footer className={styles.drawerFoot}>
                {(opened.status === "pending" || opened.status === "confirmed") && (
                  <button
                    type="button"
                    className={ui.btnDanger}
                    disabled={busyId === opened.id}
                    onClick={() => void updateStatus(opened, "cancelled")}
                  >
                    Otkaži
                  </button>
                )}
                {NEXT_STEP[opened.status] && (
                  <button
                    type="button"
                    className={ui.btnPrimary}
                    disabled={busyId === opened.id}
                    onClick={() => void updateStatus(opened, NEXT_STEP[opened.status]!.status)}
                  >
                    {busyId === opened.id ? "Čuvam…" : NEXT_STEP[opened.status]!.label}
                  </button>
                )}
              </footer>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
