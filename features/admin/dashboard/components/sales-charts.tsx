import type { MonthStat, TopPerfume } from "../server/sales-stats";
import { formatRsd } from "@/lib/format";
import styles from "./sales-charts.module.css";

/** "Lepa" gornja granica ose (1, 2, 2.5, 5 × 10^n). */
function niceMax(value: number) {
  if (value <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value)! * power;
  return step;
}

const shortRsd = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString("sr-RS", { maximumFractionDigits: 1 })} mil`
    : value >= 1000
      ? `${(value / 1000).toLocaleString("sr-RS", { maximumFractionDigits: 1 })}k`
      : String(value);

/** Revenue per month: one series, bars from zero, tooltip on hover/focus, table view below. */
export function RevenueChart({ months }: { months: MonthStat[] }) {
  const max = niceMax(Math.max(...months.map((m) => m.revenue)));
  const ticks = [max, max / 2, 0];

  return (
    <figure className={styles.figure}>
      <div className={styles.chart} role="img" aria-label="Prihod po mesecima (tabela ispod grafikona)">
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>
              {shortRsd(tick)}
            </span>
          ))}
        </div>
        <div className={styles.plot}>
          {ticks.map((tick) => (
            <span key={tick} className={styles.gridline} style={{ bottom: `${(tick / max) * 100}%` }} aria-hidden="true" />
          ))}
          {months.map((month) => {
            const height = (month.revenue / max) * 100;
            return (
              <div
                key={month.key}
                className={styles.col}
                tabIndex={0}
                style={{ "--bar-h": `${height}%` } as React.CSSProperties}
              >
                {month.revenue > 0 && <span className={styles.bar} style={{ height: `${height}%` }} />}
                <span className={styles.tip} role="tooltip">
                  <strong>{month.label}</strong>
                  <span>Prihod: {formatRsd(month.revenue)}</span>
                  <span>Porudžbina: {month.orders}</span>
                  <span>
                    Profit: {month.coverage > 0 ? formatRsd(month.profit) : "—"}
                    {month.coverage > 0 && month.coverage < 0.99 ? ` (za ${Math.round(month.coverage * 100)}% prihoda)` : ""}
                  </span>
                </span>
                <span className={styles.month}>{month.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <details className={styles.table}>
        <summary>Prikaži kao tabelu</summary>
        <table>
          <thead>
            <tr>
              <th>Mesec</th>
              <th>Porudžbine</th>
              <th>Prihod</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((month) => (
              <tr key={month.key}>
                <td>{month.label}</td>
                <td>{month.orders}</td>
                <td>{formatRsd(month.revenue)}</td>
                <td>
                  {month.coverage > 0 ? formatRsd(month.profit) : "—"}
                  {month.coverage > 0 && month.coverage < 0.99 && <small> ({Math.round(month.coverage * 100)}%)</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Best-selling perfumes: horizontal bars (decants sold), value as text. */
export function TopPerfumes({ items }: { items: TopPerfume[] }) {
  if (!items.length) return <p className={styles.empty}>Još nema prodaje.</p>;
  const max = Math.max(...items.map((item) => item.qty));

  return (
    <ol className={styles.top}>
      {items.map((item, index) => (
        <li key={item.id}>
          <span className={styles.rank}>{index + 1}</span>
          <span className={styles.topName}>
            <small>{item.brand}</small>
            {item.name}
          </span>
          <span className={styles.topTrack} aria-hidden="true">
            <span style={{ width: `${(item.qty / max) * 100}%` }} />
          </span>
          <span className={styles.topValue}>
            {item.qty}× · {formatRsd(item.revenue)}
          </span>
        </li>
      ))}
    </ol>
  );
}
