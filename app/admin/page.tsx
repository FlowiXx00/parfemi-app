import Link from "next/link";
import { PiChartLineUp, PiCoins, PiReceipt, PiShoppingBag, PiPlus, PiArrowRight } from "react-icons/pi";
import { supabaseAdmin } from "@/db/clients/admin";
import { listRecentOrders } from "@/db/queries/orders";
import { getSalesStats } from "@/features/admin/dashboard/server/sales-stats";
import { getAdminContext } from "@/features/admin/server/admin-context";
import { maskName } from "@/features/admin/demo/mask";
import { RevenueChart, TopPerfumes } from "@/features/admin/dashboard/components/sales-charts";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import StatusBadge from "@/features/admin/ui/status-badge";
import ui from "@/features/admin/ui/admin-ui.module.css";
import { formatDateTime, formatRsd } from "@/lib/format";
import styles from "./page.module.css";

// Always fresh numbers (admin).
export const dynamic = "force-dynamic";

type RecentOrder = {
  id: number;
  order_number: string;
  status: string;
  customer_full_name: string;
  customer_city: string;
  total_rsd: number;
  created_at: string;
};

/** Change vs. last month: { text, tone }, or null if last month had no sales. */
function change(current: number, previous: number) {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`, tone: pct >= 0 ? styles.up : styles.down };
}

const greeting = () => {
  const hour = Number(new Intl.DateTimeFormat("sr-RS", { hour: "numeric", hour12: false, timeZone: "Europe/Belgrade" }).format(new Date()));
  return hour < 11 ? "Dobro jutro" : hour < 18 ? "Dobar dan" : "Dobro veče";
};

export default async function AdminHomePage() {
  const [sales, recentRes, { isDemo }] = await Promise.all([
    getSalesStats(supabaseAdmin),
    listRecentOrders(supabaseAdmin),
    getAdminContext(),
  ]);
  // The demo account sees "Marko P." instead of the customer's full name
  const recent = ((recentRes.data ?? []) as RecentOrder[]).map((order) =>
    isDemo ? { ...order, customer_full_name: maskName(order.customer_full_name) } : order
  );
  const revenueChange = change(sales.thisMonth.revenue, sales.lastMonth.revenue);
  const ordersChange = change(sales.thisMonth.orders, sales.lastMonth.orders);
  const profitKnown = sales.thisMonth.coverage > 0;

  const kpis = [
    {
      label: "Prihod ovog meseca",
      value: formatRsd(sales.thisMonth.revenue),
      icon: PiCoins,
      delta: revenueChange,
      hint: revenueChange ? "u odnosu na prošli mesec" : "bez dostave, posle popusta",
    },
    {
      label: "Profit ovog meseca",
      value: profitKnown ? formatRsd(sales.thisMonth.profit) : "—",
      icon: PiChartLineUp,
      delta: null,
      hint: profitKnown
        ? sales.thisMonth.coverage < 0.99
          ? `za ${Math.round(sales.thisMonth.coverage * 100)}% prihoda (ostalima fali nabavna cena)`
          : "iz kalkulatora cena"
        : "upiši nabavnu cenu boce u kalkulatoru",
    },
    {
      label: "Porudžbine ovog meseca",
      value: String(sales.thisMonth.orders),
      icon: PiReceipt,
      delta: ordersChange,
      hint: ordersChange ? "u odnosu na prošli mesec" : `${sales.totalOrders} ukupno`,
    },
    {
      label: "Prosečna porudžbina",
      value: formatRsd(sales.avgOrder),
      icon: PiShoppingBag,
      delta: null,
      hint: `ukupno ${formatRsd(sales.totalRevenue)} prihoda`,
    },
  ];

  return (
    <div className={styles.page}>
      <AdminPageHeader
        title={`${greeting()} 👋`}
        subtitle="Pregled prodaje i poslednjih porudžbina. Otkazane porudžbine se ne računaju."
        actions={
          <>
            <Link href="/admin/perfumes" className={ui.btn}>
              <PiPlus aria-hidden="true" /> Novi parfem
            </Link>
            <Link href="/admin/orders" className={ui.btnPrimary}>
              Porudžbine <PiArrowRight aria-hidden="true" />
            </Link>
          </>
        }
      />

      <section className={styles.kpis} aria-label="Ključni brojevi">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className={`${ui.panel} ${styles.kpi}`}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <span className={styles.kpiIcon} aria-hidden="true">
                  <Icon />
                </span>
              </div>
              <strong className={styles.kpiValue}>{kpi.value}</strong>
              <span className={styles.kpiHint}>
                {kpi.delta && <span className={`${styles.delta} ${kpi.delta.tone}`}>{kpi.delta.text}</span>} {kpi.hint}
              </span>
            </article>
          );
        })}
      </section>

      <section className={ui.panel}>
        <div className={ui.panelHead}>
          <h2 className={ui.panelTitle}>Prihod po mesecima</h2>
          <span className={styles.muted}>poslednjih 12 meseci</span>
        </div>
        <RevenueChart months={sales.months} />
      </section>

      <section className={styles.split}>
        <article className={ui.panel}>
          <div className={ui.panelHead}>
            <h2 className={ui.panelTitle}>Najprodavaniji parfemi</h2>
            <Link href="/admin/perfumes" className={ui.panelLink}>
              Svi parfemi →
            </Link>
          </div>
          <TopPerfumes items={sales.top} />
        </article>

        <article className={ui.panel}>
          <div className={ui.panelHead}>
            <h2 className={ui.panelTitle}>Poslednje porudžbine</h2>
            <Link href="/admin/orders" className={ui.panelLink}>
              Sve porudžbine →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className={styles.muted}>Još nema porudžbina.</p>
          ) : (
            <ul className={styles.recent}>
              {recent.map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders?open=${order.id}`} className={styles.recentRow}>
                    <span className={styles.recentMain}>
                      <strong>{order.customer_full_name}</strong>
                      <small>
                        #{order.order_number} · {order.customer_city} · {formatDateTime(order.created_at)}
                      </small>
                    </span>
                    <span className={styles.recentSide}>
                      <strong>{formatRsd(order.total_rsd)}</strong>
                      <StatusBadge status={order.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
