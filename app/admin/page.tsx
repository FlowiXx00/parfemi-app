import Link from "next/link";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import styles from "./page.module.css";

type OrderStatsRow = {
  status: string | null;
  total_rsd: number | string | null;
};

async function fetchAllOrderStats(totalOrders: number) {
  const pageSize = 1000;
  const rows: OrderStatsRow[] = [];

  for (let from = 0; from < totalOrders; from += pageSize) {
    const to = Math.min(from + pageSize - 1, totalOrders - 1);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("status, total_rsd")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as OrderStatsRow[]));
  }

  return rows;
}

async function getDashboardData() {
  const [ordersCountRes, perfumesCountRes] = await Promise.all([
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("perfumes").select("id", { count: "exact", head: true }),
  ]);

  const totalOrders = ordersCountRes.count ?? 0;
  const orders = totalOrders > 0 ? await fetchAllOrderStats(totalOrders) : [];

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.total_rsd ?? 0),
    0
  );
  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const confirmedCount = orders.filter((order) => order.status === "confirmed").length;
  const shippedCount = orders.filter((order) => order.status === "shipped").length;

  return {
    totalOrders,
    totalPerfumes: perfumesCountRes.count ?? 0,
    totalRevenue,
    pendingCount,
    confirmedCount,
    shippedCount,
  };
}

function formatRsd(value: number) {
  return `${new Intl.NumberFormat("sr-RS").format(value)} rsd`;
}

export default async function AdminHomePage() {
  const stats = await getDashboardData();

  return (
    <main className={styles.page}>
      <section className={`${styles.hero} ui-glass-card`}>
        <div>
          <div className={styles.kicker}>Admin pregled</div>
          <h1 className={styles.title}>Kontrolna tabla</h1>
          <p className={styles.subtitle}>
            Brzi pregled porudžbina, prihoda i kataloga na jednom mestu.
          </p>
        </div>

        <div className={`${styles.actions} ui-actions-row`}>
          <Link href="/admin/orders" className={`${styles.primaryBtn} ui-btn-primary`}>
            Porudžbine
          </Link>
          <Link href="/admin/perfumes" className={`${styles.secondaryBtn} ui-btn-secondary`}>
            Parfemi
          </Link>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <article className={`${styles.statCard} ui-glass-card`}>
          <div className={styles.statLabel}>Ukupno porudžbina</div>
          <div className={styles.statValue}>{stats.totalOrders}</div>
        </article>

        <article className={`${styles.statCard} ui-glass-card`}>
          <div className={styles.statLabel}>Ukupan prihod</div>
          <div className={styles.statValue}>{formatRsd(stats.totalRevenue)}</div>
        </article>

        <article className={`${styles.statCard} ui-glass-card`}>
          <div className={styles.statLabel}>Parfemi u katalogu</div>
          <div className={styles.statValue}>{stats.totalPerfumes}</div>
        </article>

        <article className={`${styles.statCard} ui-glass-card`}>
          <div className={styles.statLabel}>Čeka potvrdu</div>
          <div className={styles.statValue}>{stats.pendingCount}</div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={`${styles.card} ui-glass-card`}>
          <h2 className={styles.cardTitle}>Status porudžbina</h2>
          <div className={styles.statusList}>
            <div className={styles.statusRow}>
              <span>Na čekanju</span>
              <strong>{stats.pendingCount}</strong>
            </div>
            <div className={styles.statusRow}>
              <span>Potvrđene</span>
              <strong>{stats.confirmedCount}</strong>
            </div>
            <div className={styles.statusRow}>
              <span>Poslate</span>
              <strong>{stats.shippedCount}</strong>
            </div>
          </div>
        </article>

        <article className={`${styles.card} ui-glass-card`}>
          <h2 className={styles.cardTitle}>Brze akcije</h2>
          <div className={styles.quickLinks}>
            <Link href="/admin/orders" className={`${styles.quickLink} ui-btn-secondary`}>
              Pregled i izmena statusa porudžbina
            </Link>
            <Link href="/admin/perfumes" className={`${styles.quickLink} ui-btn-secondary`}>
              Dodavanje, izmena i brisanje parfema
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
