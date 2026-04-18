import Link from "next/link";
import styles from "./info-page.module.css";

type InfoSection = {
  title: string;
  body: string[];
};

type InfoPageProps = {
  kicker: string;
  title: string;
  intro: string;
  sections: InfoSection[];
  ctaTitle?: string;
  ctaText?: string;
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
};

export default function InfoPage({
  kicker,
  title,
  intro,
  sections,
  ctaTitle,
  ctaText,
  ctaPrimary,
  ctaSecondary,
}: InfoPageProps) {
  return (
    <main className={`${styles.page} ui-page-glass`}>
      <div className="sectionContainerNarrow">
        <section className={`${styles.hero} ui-glass-card`}>
          <div className={styles.kicker}>{kicker}</div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
        </section>

        <section className={styles.grid}>
          {sections.map((section) => (
            <article key={section.title} className={`${styles.card} ui-glass-card`}>
              <h2 className={styles.cardTitle}>{section.title}</h2>

              <div className={styles.copy}>
                {section.body.map((paragraph, index) => (
                  <p key={`${section.title}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>

        {(ctaTitle || ctaText || ctaPrimary || ctaSecondary) && (
          <section className={`${styles.cta} ui-glass-card`}>
            <div>
              {ctaTitle && <h2 className={styles.ctaTitle}>{ctaTitle}</h2>}
              {ctaText && <p className={styles.ctaText}>{ctaText}</p>}
            </div>

            {(ctaPrimary || ctaSecondary) && (
              <div className={`${styles.actions} ui-actions-row`}>
                {ctaPrimary && (
                  <Link href={ctaPrimary.href} className={`${styles.primaryBtn} ui-btn-primary`}>
                    {ctaPrimary.label}
                  </Link>
                )}

                {ctaSecondary && (
                  <Link href={ctaSecondary.href} className={`${styles.secondaryBtn} ui-btn-secondary`}>
                    {ctaSecondary.label}
                  </Link>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
