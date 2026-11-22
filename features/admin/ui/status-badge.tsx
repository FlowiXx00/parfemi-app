import styles from "./admin-ui.module.css";

const LABELS: Record<string, string> = {
  pending: "Nova",
  confirmed: "Potvrđena",
  shipped: "Poslata",
  received: "Preuzeta",
  cancelled: "Otkazana",
};

/** Order status badge (color + dot + text, never color alone). */
export default function StatusBadge({ status }: { status: string }) {
  return <span className={`${styles.status} ${styles[`status_${status}`] ?? ""}`}>{LABELS[status] ?? status}</span>;
}
