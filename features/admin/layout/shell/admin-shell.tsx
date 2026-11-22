"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  PiArrowSquareOut,
  PiGear,
  PiGift,
  PiList,
  PiReceipt,
  PiSignOut,
  PiSquaresFour,
  PiStar,
  PiTicket,
  PiDrop,
  PiEye,
  PiX,
} from "react-icons/pi";
import { createClient } from "@/db/clients/browser";
import styles from "./admin-shell.module.css";

type NavItem = { href: string; label: string; icon: typeof PiGear; badge?: number };

/** Admin shell: sidebar (desktop) / drawer (mobile) + content. Always dark theme. */
export default function AdminShell({
  displayName,
  pendingCount,
  isDemo = false,
  children,
}: {
  displayName: string;
  pendingCount: number;
  /** Demo account: read-only (the server rejects changes, customers are masked) */
  isDemo?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Prodaja",
      items: [
        { href: "/admin", label: "Pregled", icon: PiSquaresFour },
        { href: "/admin/orders", label: "Porudžbine", icon: PiReceipt, badge: pendingCount },
      ],
    },
    {
      label: "Katalog",
      items: [
        { href: "/admin/perfumes", label: "Parfemi", icon: PiDrop },
        { href: "/admin/paketi", label: "Paketi", icon: PiGift },
        { href: "/admin/ocene", label: "Ocene", icon: PiStar },
      ],
    },
    { label: "Marketing", items: [{ href: "/admin/kuponi", label: "Kuponi", icon: PiTicket }] },
    { label: "Sistem", items: [{ href: "/admin/podesavanja", label: "Podešavanja", icon: PiGear }] },
  ];

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));
  const current = groups.flatMap((group) => group.items).find((item) => isActive(item.href));

  // Mobile drawer: close on route change and on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Dark theme only while in the admin (the storefront follows the device theme).
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "dark");
    return () => {
      if (previous) root.setAttribute("data-theme", previous);
      else root.removeAttribute("data-theme");
    };
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await supabase?.auth.signOut();
      router.refresh();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  const initial = displayName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className={styles.shell}>
      {/* Top bar, mobile only */}
      <header className={styles.mobileBar}>
        <button type="button" className={styles.iconBtn} onClick={() => setOpen(true)} aria-label="Otvori meni">
          <PiList />
        </button>
        <span className={styles.mobileTitle}>{current?.label ?? "Admin"}</span>
        <Link href="/" className={styles.iconBtn} aria-label="Pogledaj sajt" target="_blank">
          <PiArrowSquareOut />
        </Link>
      </header>

      {open && <button type="button" className={styles.scrim} aria-label="Zatvori meni" onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="Admin meni">
        <div className={styles.brand}>
          <Link href="/admin" className={styles.logo} onClick={() => setOpen(false)}>
            <span className={styles.logoMark} aria-hidden="true">◆</span>
            <span>
              Atelier Dekant
              <small>Admin</small>
            </span>
          </Link>
          <button type="button" className={`${styles.iconBtn} ${styles.closeBtn}`} onClick={() => setOpen(false)} aria-label="Zatvori meni">
            <PiX />
          </button>
        </div>

        <nav className={styles.nav}>
          {groups.map((group) => (
            <div key={group.label} className={styles.group}>
              <span className={styles.groupLabel}>{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.link} ${active ? styles.linkActive : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon aria-hidden="true" className={styles.linkIcon} />
                    <span>{item.label}</span>
                    {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <Link href="/" target="_blank" className={styles.footerLink}>
            <PiArrowSquareOut aria-hidden="true" /> Pogledaj sajt
          </Link>
          <div className={styles.user}>
            <span className={styles.avatar} aria-hidden="true">
              {initial}
            </span>
            <span className={styles.userText}>
              <strong>{displayName}</strong>
              <small>{isDemo ? "Demo pregled" : "Administrator"}</small>
            </span>
            <button type="button" className={styles.iconBtn} onClick={() => void logout()} disabled={loggingOut} aria-label="Odjavi se" title="Odjavi se">
              <PiSignOut />
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        {isDemo && (
          <div className={styles.demoBanner} role="note">
            <PiEye aria-hidden="true" />
            <span>
              <strong>Demo režim</strong> — slobodno razgledaj; izmene se ne čuvaju, a podaci kupaca su skriveni.
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
