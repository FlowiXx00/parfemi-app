"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import styles from "./decant-vial.module.css";

/** Vial interior (coordinates in the 0 0 160 320 viewBox). */
const BODY_TOP = 142;
const BODY_BOTTOM = 298;
const BODY_HEIGHT = BODY_BOTTOM - BODY_TOP;
const DROPPER_TIP_Y = 116;

/** Trajanje faza animacije (ms). */
const UNCAP_MS = 420;
const POUR_MS = 1300;
const CAP_MS = 900;

type Tick = { ml: number; active: boolean };

/**
 * Phases:
 * empty – open, empty vial
 * uncap – the cap unscrews and lifts (when the volume changes)
 * pour – the pipette lowers and drips, the liquid rises
 * cap – the pipette leaves, the cap lowers and screws on
 * done – filled, closed vial
 */
type Phase = "empty" | "uncap" | "pour" | "cap" | "done";

/**
 * Decant vial: filled from a pipette, closed with a sprayer cap.
 * Every change of `fillKey` runs the whole sequence.
 */
export default function DecantVial({
  color,
  ratio,
  ticks,
  maxMl,
  fillKey,
  brand,
  name,
  ml,
}: {
  color: string;
  ratio: number;
  ticks: Tick[];
  maxMl: number;
  fillKey: number;
  brand: string;
  name: string;
  ml: number | null;
}) {
  const id = useId().replace(/:/g, "");
  const [phase, setPhase] = useState<Phase>("empty");
  /** Displayed liquid level (only changes once the pipette starts dripping). */
  const [shownRatio, setShownRatio] = useState(0);
  // Latest level and phase for the timers below (without restarting the animation).
  const capturedRef = useRef({ ratio, phase });

  useEffect(() => {
    capturedRef.current = { ratio, phase };
  });

  useEffect(() => {
    if (fillKey === 0) return;

    const wasClosed = capturedRef.current.phase === "done" || capturedRef.current.phase === "cap";
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    let t = 0;
    if (wasClosed) {
      at(t, () => setPhase("uncap"));
      t += UNCAP_MS;
    }
    at(t, () => {
      setPhase("pour");
      setShownRatio(capturedRef.current.ratio);
    });
    t += POUR_MS;
    at(t, () => setPhase("cap"));
    t += CAP_MS;
    at(t, () => {
      setPhase("done");
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [fillKey]);

  const clamped = Math.max(0, Math.min(1, shownRatio));
  const liquidTop = BODY_BOTTOM - clamped * BODY_HEIGHT;
  const fall = Math.max(30, liquidTop - DROPPER_TIP_Y - 4);
  const capOn = phase === "cap" || phase === "done";
  const dropperIn = phase === "pour";
  const shortName = name.replace(new RegExp(`^${brand}\\s+`, "i"), "");

  return (
    <svg
      className={styles.vial}
      viewBox="0 50 160 270"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={
        ml ? `Bočica ${brand} ${shortName}, ${ml} ml` : "Prazna bočica za dekant"
      }
      style={{ "--liquid": color, "--fall": `${fall}px` } as CSSProperties}
    >
      <defs>
        <clipPath id={`body-${id}`}>
          <path d="M46 142 h48 v138 a18 18 0 0 1 -18 18 h-12 a18 18 0 0 1 -18 -18 z" />
        </clipPath>
        <linearGradient id={`liquid-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--liquid)" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="var(--liquid)" stopOpacity="0.72" />
          <stop offset="1" stopColor="var(--liquid)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.1" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.2" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.92" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`metal-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8a6b33" />
          <stop offset="0.3" stopColor="#f3dc9b" />
          <stop offset="0.55" stopColor="#c7a567" />
          <stop offset="1" stopColor="#7d5f2c" />
        </linearGradient>
      </defs>

      {/* ---------- Pipette (only while dripping) ---------- */}
      <g className={`${styles.dropper} ${dropperIn ? styles.dropperIn : ""}`}>
        <path className={styles.bulb} d="M60 62 a10 10 0 0 1 20 0 v6 a10 10 0 0 1 -20 0 z" />
        <rect className={styles.collar} x="57" y="78" width="26" height="6" rx="2" />
        <path className={styles.tube} d="M64 84 h12 v18 l-4 14 h-4 l-4 -14 z" />
        <path
          key={`tube-${fillKey}`}
          className={dropperIn ? styles.tubeLiquidDrain : styles.tubeLiquid}
          d="M66 90 h8 v12 l-3 12 h-2 l-3 -12 z"
          fill="var(--liquid)"
        />
      </g>

      {dropperIn && (
        <g key={`drops-${fillKey}`}>
          {[0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              className={styles.drop}
              style={{ animationDelay: `${250 + i * 190}ms` }}
              cx="70"
              cy={DROPPER_TIP_Y}
              rx="2.6"
              ry="3.6"
              fill="var(--liquid)"
            />
          ))}
        </g>
      )}

      {/* ---------- Vial ---------- */}
      <rect className={styles.neck} x="56" y="122" width="28" height="20" rx="3" />
      <line className={styles.neckThread} x1="56" x2="84" y1="128" y2="128" />
      <line className={styles.neckThread} x1="56" x2="84" y1="134" y2="134" />

      {/* ---------- Cap with sprayer ---------- */}
      <g className={`${styles.cap} ${capOn ? styles.capOn : ""} ${phase === "cap" ? styles.capTwist : ""}`}>
        <rect className={styles.sprayButton} x="62" y="106" width="16" height="12" rx="3" />
        <rect className={styles.sprayNozzle} x="77" y="110" width="5" height="3" rx="1" />
        <rect x="52" y="118" width="36" height="24" rx="4" fill={`url(#metal-${id})`} />
        {/* threads: move while the cap screws on */}
        <g className={styles.threads} clipPath={`url(#cap-${id})`}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={46 + i * 7} y="118" width="2" height="24" fill="#000" opacity="0.12" />
          ))}
        </g>
        <clipPath id={`cap-${id}`}>
          <rect x="52" y="118" width="36" height="24" rx="4" />
        </clipPath>
      </g>

      <g clipPath={`url(#body-${id})`}>
        <g
          className={styles.liquidGroup}
          style={{
            transform: `translateY(${liquidTop - BODY_TOP}px)`,
            opacity: clamped > 0 ? 1 : 0,
          }}
        >
          <rect x="40" y={BODY_TOP} width="60" height={BODY_HEIGHT + 6} fill={`url(#liquid-${id})`} />
          <ellipse className={styles.meniscus} cx="70" cy={BODY_TOP} rx="26" ry="2.6" fill="var(--liquid)" />
        </g>
        <rect x="46" y={BODY_TOP} width="48" height={BODY_HEIGHT} fill={`url(#glass-${id})`} />
      </g>
      <path
        className={styles.glass}
        d="M46 142 h48 v138 a18 18 0 0 1 -18 18 h-12 a18 18 0 0 1 -18 -18 z"
      />

      {/* ---------- Oznake zapremine ---------- */}
      {ticks.map((tick) => {
        const y = BODY_BOTTOM - (tick.ml / maxMl) * BODY_HEIGHT;
        return (
          <g key={tick.ml} className={tick.active ? styles.tickActive : styles.tick}>
            <line x1="98" x2="108" y1={y} y2={y} />
            <text x="112" y={y + 4}>
              {tick.ml}ml
            </text>
          </g>
        );
      })}
    </svg>
  );
}
