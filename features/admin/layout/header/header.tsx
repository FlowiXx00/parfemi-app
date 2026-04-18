"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/shared/supabase/supabase-client";
import styles from "./header.module.css";

type Props = {
  displayName: string;
};

export default function AdminHeader({ displayName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      if (!supabase) {
        router.replace("/login");
        return;
      }

      await supabase.auth.signOut();
      router.refresh();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Admin panel</p>
          <h1
  className={styles.title}
  data-autofit
  data-autofit-max="32"
  data-autofit-min="18"
>
  Dobrodošao, {displayName}
</h1>
          <p className={styles.subtitle}>
            Ovde možeš brzo da upravljaš porudžbinama i parfemima.
          </p>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.logoutBtn}
            onClick={logout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Odjava..." : "Logout"}
          </button>
        </div>
      </div>

      <nav className={styles.nav}>
        <Link
          href="/admin"
          className={`${styles.navLink} ${
            pathname === "/admin" ? styles.navLinkActive : ""
          }`}
        >
          Dashboard
        </Link>

        <Link
          href="/admin/orders"
          className={`${styles.navLink} ${
            pathname === "/admin/orders" ? styles.navLinkActive : ""
          }`}
        >
          Porudžbine
        </Link>

        <Link
          href="/admin/perfumes"
          className={`${styles.navLink} ${
            pathname === "/admin/perfumes" ? styles.navLinkActive : ""
          }`}
        >
          Parfemi
        </Link>
      </nav>
    </div>
  );
}