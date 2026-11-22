import type { ReactNode } from "react";
import styles from "./status-page.module.css";

/**
 * Shared layout for 404 and error pages: big code with a gold glow,
 * title, short explanation and buttons (no hooks, so it works in server and client components).
 */
export default function StatusPage({
  code,
  kicker,
  title,
  text,
  children,
  footer,
}: {
  code: string;
  kicker: string;
  title: string;
  text: ReactNode;
  /** Buttons / form below the text */
  children?: ReactNode;
  /** Small print at the bottom (e.g. error digest) */
  footer?: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.code} aria-hidden="true">
          {code}
        </span>
        <span className={styles.kicker}>{kicker}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        {children && <div className={styles.actions}>{children}</div>}
        {footer && <p className={styles.footer}>{footer}</p>}
      </section>
    </main>
  );
}

export { styles as statusPageStyles };
