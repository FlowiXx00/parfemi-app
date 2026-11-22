import "server-only";
import type { Db } from "@/db/types";
import { stripBrandPrefix } from "@/features/shop/lib/product-name";

/**
 * Sales stats for the admin dashboard (computed on the server from orders).
 * - Revenue = goods after discount (shipping excluded). Cancelled orders don't count.
 * - Profit = line revenue − cost from the price calculator (bottle price / bottle ml × ml + packaging).
 * Only computed for perfumes with a cost entered; "coverage" says what share of revenue that is.
 */

type OrderRow = {
  id: number;
  status: string;
  created_at: string;
  subtotal_rsd: number;
  discount_rsd: number;
  shipping_rsd: number;
};

type ItemRow = {
  order_id: number;
  perfume_id: string;
  perfume_name: string;
  perfume_brand: string | null;
  ml: number;
  qty: number;
  line_total_rsd: number;
};

type CostRow = {
  perfume_id: string;
  bottle_price_rsd: number | null;
  bottle_ml: number | null;
  packaging_rsd: number | null;
};

export type MonthStat = {
  key: string; // "2026-11"
  label: string; // "nov 26"
  revenue: number;
  orders: number;
  profit: number;
  /** Share of revenue (0–1) with a known cost */
  coverage: number;
};

export type TopPerfume = { id: string; name: string; brand: string; qty: number; ml: number; revenue: number };

export type SalesStats = {
  months: MonthStat[];
  top: TopPerfume[];
  thisMonth: MonthStat;
  lastMonth: MonthStat;
  totalRevenue: number;
  totalOrders: number;
  avgOrder: number;
  shippingCollected: number;
};

const PAGE = 1000;

async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

/** Month in Belgrade time (an order at 00:30 on the 1st belongs to that month). */
function monthKey(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit" }).formatToParts(
    new Date(iso)
  );
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

function lastMonths(count: number) {
  const now = new Date();
  const [year, month] = monthKey(now.toISOString()).split("-").map(Number) as [number, number];
  const keys: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    keys.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTH_NAMES[m]} ${String(y).slice(2)}` });
  }
  return keys;
}

/** "Aventus (paket „Top 5 muških”)" -> "Aventus" (the top list groups by perfume). */
const cleanName = (name: string) => name.replace(/\s*\(paket „.*”\)\s*$/, "");

export async function getSalesStats(db: Db, monthsBack = 12): Promise<SalesStats> {
  const [orders, items, costs] = await Promise.all([
    readAll<OrderRow>((from, to) =>
      db
        .from("orders")
        .select("id, status, created_at, subtotal_rsd, discount_rsd, shipping_rsd")
        .neq("status", "cancelled")
        .order("id")
        .range(from, to)
    ),
    readAll<ItemRow>((from, to) =>
      db
        .from("order_items")
        .select("order_id, perfume_id, perfume_name, perfume_brand, ml, qty, line_total_rsd")
        .order("id")
        .range(from, to)
    ),
    readAll<CostRow>((from, to) =>
      db.from("perfume_costs").select("perfume_id, bottle_price_rsd, bottle_ml, packaging_rsd").range(from, to)
    ),
  ]);

  const costById = new Map(costs.map((c) => [c.perfume_id, c]));
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const months = lastMonths(monthsBack).map(
    ({ key, label }): MonthStat & { known: number } => ({ key, label, revenue: 0, orders: 0, profit: 0, coverage: 0, known: 0 })
  );
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  for (const order of orders) {
    const i = monthIndex.get(monthKey(order.created_at));
    if (i === undefined) continue;
    months[i]!.orders += 1;
    months[i]!.revenue += Math.max(0, Number(order.subtotal_rsd) - Number(order.discount_rsd));
  }

  const top = new Map<string, TopPerfume>();

  for (const item of items) {
    const order = orderById.get(item.order_id);
    if (!order) continue; // cancelled order

    // The order discount is spread across lines in proportion to their value.
    const subtotal = Number(order.subtotal_rsd) || 1;
    const share = Math.max(0, 1 - Number(order.discount_rsd) / subtotal);
    const itemRevenue = Number(item.line_total_rsd) * share;

    const entry = top.get(item.perfume_id) ?? {
      id: item.perfume_id,
      name: stripBrandPrefix(item.perfume_brand, cleanName(item.perfume_name)),
      brand: item.perfume_brand ?? "",
      qty: 0,
      ml: 0,
      revenue: 0,
    };
    entry.qty += Number(item.qty);
    entry.ml += Number(item.ml) * Number(item.qty);
    entry.revenue += itemRevenue;
    top.set(item.perfume_id, entry);

    const i = monthIndex.get(monthKey(order.created_at));
    if (i === undefined) continue;
    const cost = costById.get(item.perfume_id);
    if (cost?.bottle_price_rsd && cost.bottle_ml) {
      const unitCost = (Number(cost.bottle_price_rsd) / Number(cost.bottle_ml)) * Number(item.ml) + Number(cost.packaging_rsd ?? 0);
      months[i]!.profit += itemRevenue - unitCost * Number(item.qty);
      months[i]!.known += itemRevenue;
    }
  }

  const finalMonths: MonthStat[] = months.map(({ known, ...m }) => ({
    ...m,
    revenue: Math.round(m.revenue),
    profit: Math.round(m.profit),
    coverage: m.revenue > 0 ? Math.min(1, known / m.revenue) : 0,
  }));

  const totalRevenue = orders.reduce((sum, o) => sum + Math.max(0, Number(o.subtotal_rsd) - Number(o.discount_rsd)), 0);
  const empty: MonthStat = { key: "", label: "", revenue: 0, orders: 0, profit: 0, coverage: 0 };

  return {
    months: finalMonths,
    top: [...top.values()]
      .map((t) => ({ ...t, revenue: Math.round(t.revenue) }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 10),
    thisMonth: finalMonths[finalMonths.length - 1] ?? empty,
    lastMonth: finalMonths[finalMonths.length - 2] ?? empty,
    totalRevenue: Math.round(totalRevenue),
    totalOrders: orders.length,
    avgOrder: orders.length ? Math.round(totalRevenue / orders.length) : 0,
    shippingCollected: orders.reduce((sum, o) => sum + Number(o.shipping_rsd), 0),
  };
}
