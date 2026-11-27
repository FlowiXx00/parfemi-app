"use client";

import { useState } from "react";
import { FiCopy, FiTruck } from "react-icons/fi";
import { trackingLinkHasNumber, trackingUrl } from "@/features/orders/lib/tracking";
import styles from "./tracking-info.module.css";

/** Post Express shipment number for the customer: copy it and open Pošta Srbije's tracking page. */
export default function TrackingInfo({ trackingNumber }: { trackingNumber: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <FiTruck aria-hidden="true" />
        <span>Broj pošiljke</span>
      </div>
      <div className={styles.row}>
        <code className={styles.number}>{trackingNumber}</code>
        <button type="button" className={styles.copy} onClick={() => void copy()}>
          <FiCopy aria-hidden="true" /> {copied ? "Kopirano ✓" : "Kopiraj"}
        </button>
      </div>
      <a className={styles.link} href={trackingUrl(trackingNumber)} target="_blank" rel="noreferrer">
        Prati pošiljku na sajtu Pošte →
      </a>
      {!trackingLinkHasNumber() && (
        <p className={styles.hint}>Na stranici Pošte nalepi broj i klikni „Pratite”.</p>
      )}
    </div>
  );
}
