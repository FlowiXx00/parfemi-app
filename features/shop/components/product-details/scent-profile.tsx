import {
  PiFlowerTulip,
  PiLeaf,
  PiMoonStars,
  PiSnowflake,
  PiSun,
  PiSunHorizon,
} from "react-icons/pi";
import { accordColor, DAY_NIGHT, SEASONS, type Accord, type Notes, type Wear, type WearKey } from "@/features/shop/lib/scent";
import styles from "./scent-profile.module.css";

const WEAR_ICONS: Record<WearKey, typeof PiSun> = {
  spring: PiFlowerTulip,
  summer: PiSun,
  fall: PiLeaf,
  winter: PiSnowflake,
  day: PiSunHorizon,
  night: PiMoonStars,
};

const LAYERS: { key: keyof Notes; label: string; hint: string }[] = [
  { key: "top", label: "Otvaranje", hint: "prvih 15–30 min" },
  { key: "middle", label: "Srce", hint: "posle pola sata" },
  { key: "base", label: "Baza", hint: "ostaje satima" },
];

export function hasScentProfile(accords: Accord[], notes: Notes, wear: Wear) {
  return accords.length > 0 || notes.top.length + notes.middle.length + notes.base.length > 0 || Object.keys(wear).length > 0;
}

/** Scent profile on the product page: accords, note pyramid and when to wear. */
export default function ScentProfile({ accords, notes, wear }: { accords: Accord[]; notes: Notes; wear: Wear }) {
  const layers = LAYERS.filter((layer) => notes[layer.key].length > 0);
  const hasWear = Object.keys(wear).length > 0;
  const blockCount = [accords.length > 0, layers.length > 0, hasWear].filter(Boolean).length;
  // With all three blocks: notes on the right at full height, accords and seasons on the left.
  const notesTall = blockCount === 3;

  return (
    <div className={`${styles.profile} ${blockCount === 1 ? styles.single : ""}`}>
      {accords.length > 0 && (
        <section className={styles.block} aria-labelledby="scent-accords">
          <h3 id="scent-accords" className={styles.kicker}>
            Glavni akordi
          </h3>
          <ul className={styles.accords}>
            {accords.slice(0, 7).map((accord) => (
              <li key={accord.name}>
                <span className={styles.accordName}>{accord.name}</span>
                <span className={styles.track}>
                  <span
                    className={styles.bar}
                    style={{ width: `${accord.strength}%`, background: accordColor(accord.name) }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {layers.length > 0 && (
        <section className={`${styles.block} ${notesTall ? styles.tall : ""}`} aria-labelledby="scent-notes">
          <h3 id="scent-notes" className={styles.kicker}>
            Note
          </h3>
          <ol className={styles.pyramid}>
            {layers.map((layer) => (
              <li key={layer.key} className={styles.layer}>
                <div className={styles.layerHead}>
                  <strong>{layer.label}</strong>
                  <small>{layer.hint}</small>
                </div>
                <ul className={styles.chips}>
                  {notes[layer.key].map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasWear && (
        <section className={styles.block} aria-labelledby="scent-wear">
          <h3 id="scent-wear" className={styles.kicker}>
            Kada nositi
          </h3>
          <div className={styles.wearGrid}>
            {[...SEASONS, ...DAY_NIGHT].map(({ key, label }) => {
              const value = wear[key] ?? 0;
              const Icon = WEAR_ICONS[key];
              return (
                <div key={key} className={`${styles.wearItem} ${value >= 60 ? styles.wearStrong : ""}`}>
                  <Icon aria-hidden="true" className={styles.wearIcon} />
                  <span className={styles.wearLabel}>{label}</span>
                  <span className={styles.wearTrack} aria-hidden="true">
                    <span style={{ width: `${value}%` }} />
                  </span>
                  <span className={styles.srOnly}>{value}%</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
