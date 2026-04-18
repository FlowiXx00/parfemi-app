"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FiLogIn, FiUser, FiUserPlus } from "react-icons/fi";
import styles from "./account-page-view.module.css";
import {
  getAvatarUrl,
  getUserDisplayName,
  getUserInitials,
} from "@/shared/auth/client/auth-user";
import { useAuthUser } from "@/shared/auth/client/use-auth-user";
import MyAccount from "../my-account/my-account";

export default function AccountPageView() {
  const { authUser, profile, loading } = useAuthUser({ initialLoading: true });

  const userDisplayName = useMemo(() => getUserDisplayName(authUser, profile), [authUser, profile]);
  const userInitials = useMemo(() => getUserInitials(authUser, profile), [authUser, profile]);
  const userAvatarUrl = useMemo(() => getAvatarUrl(authUser, profile), [authUser, profile]);

  if (loading) {
    return (
      <main className={`${styles.page} ui-page-glass`}>
        <div className="sectionContainer">
          <div className={`${styles.loadingCard} ui-glass-card`}>Učitavanje naloga...</div>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className={`${styles.page} ui-page-glass`}>
        <div className="sectionContainer">
          <section className={`${styles.guestCard} ui-glass-card`}>
            <div className={styles.guestIcon}>
              <FiUser />
            </div>

            <h1 className={styles.guestTitle}>Moj nalog</h1>
            <p className={styles.guestText}>
              Prijavi se ili kreiraj nalog da pratiš porudžbine, sačuvaš omiljene
              proizvode i ubrzaš kupovinu.
            </p>

            <div className={`${styles.guestActions} ui-actions-row`}>
              <Link href="/login?next=/account" className={`${styles.primaryBtn} ui-btn-primary`}>
                <FiLogIn />
                <span>Prijavi se</span>
              </Link>

              <Link href="/register?next=/account" className={`${styles.secondaryBtn} ui-btn-secondary`}>
                <FiUserPlus />
                <span>Registruj se</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <MyAccount
      userDisplayName={userDisplayName}
      userInitials={userInitials}
      userAvatarUrl={userAvatarUrl}
      email={authUser.email ?? null}
      phone={authUser.user_metadata?.phone ?? null}
    />
  );
}
