"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./analytics.module.css";

/**
 * Google Analytics 4 + Meta Pixel, loaded only after the visitor ACCEPTS cookies (data protection law).
 * IDs in .env.local: NEXT_PUBLIC_GA_ID=G-XXXX NEXT_PUBLIC_META_PIXEL_ID=1234567890
 * Without IDs the cookie banner isn't shown either.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const CONSENT_KEY = "atelier-consent";
const CONSENT_EVENT = "atelier-consent-change";
const REOPEN_EVENT = "atelier-consent-reopen";

type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Deletes analytics cookies (_ga, _ga_*, _gid, _fbp) for this domain and its subdomains. */
function clearAnalyticsCookies() {
  const names = document.cookie.split(";").map((part) => part.split("=")[0]!.trim());
  const domains = ["", location.hostname, `.${location.hostname.replace(/^www\./, "")}`];
  for (const name of names) {
    if (!/^(_ga|_gid|_gat|_fbp)/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

function saveConsent(value: "granted" | "denied") {
  const previous = readConsent();
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // private window: the choice lasts until the page is closed
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
  // Consent withdrawn: delete the cookies and reload so already-loaded scripts stop.
  if (value === "denied" && previous === "granted") {
    clearAnalyticsCookies();
    window.location.reload();
  }
}

/** "Cookie settings" link in the footer: shows the consent banner again. */
export function reopenCookieBanner() {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

/** Whether analytics is configured at all (without it there's no banner and no footer link). */
export const analyticsEnabled = Boolean(GA_ID || PIXEL_ID);

export default function Analytics() {
  const consent = useSyncExternalStore(subscribe, readConsent, () => "denied" as Consent);
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  const [reopened, setReopened] = useState(false);
  const pathname = usePathname();
  const enabled = analyticsEnabled;

  useEffect(() => {
    const open = () => {
      setReopened(true);
      setDismissedThisVisit(false);
    };
    window.addEventListener(REOPEN_EVENT, open);
    return () => window.removeEventListener(REOPEN_EVENT, open);
  }, []);

  // Meta Pixel: PageView on every route change (GA4 handles this itself via browser history).
  useEffect(() => {
    if (consent === "granted" && PIXEL_ID) window.fbq?.("track", "PageView");
  }, [consent, pathname]);

  if (!enabled) return null;

  return (
    <>
      {consent === "granted" && GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {consent === "granted" && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}

      {(reopened || consent === null) && !dismissedThisVisit && (
        <div className={styles.banner} role="dialog" aria-live="polite" aria-label="Kolačići">
          <p>
            Koristimo kolačiće za analitiku poseta, da bismo poboljšali sajt i ponudu.{" "}
            <Link href="/cookie-policy">Saznaj više</Link>
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                saveConsent("denied");
                setDismissedThisVisit(true);
                setReopened(false);
              }}
            >
              Odbij
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                saveConsent("granted");
                setReopened(false);
              }}
            >
              Prihvati
            </button>
          </div>
        </div>
      )}
    </>
  );
}
