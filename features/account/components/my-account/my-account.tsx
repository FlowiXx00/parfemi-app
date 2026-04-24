"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiHeart,
  FiMapPin,
  FiPackage,
  FiSettings,
} from "react-icons/fi";
import styles from "./my-account.module.css";
import statusStyles from "@/shared/orders/order-status.module.css";
import { getOrderStatusMeta, type OrderStatus } from "@/shared/orders/order-status";
import { readWishlist } from "@/features/wishlist/client/wishlist.api";
import { loadAddressesRequest } from "@/features/account/client/addresses.api";

type MyAccountProps = {
  userDisplayName: string;
  userInitials: string;
  userAvatarUrl: string | null;
  email: string | null;
  phone: string | null;
};

type LastOrder = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  totalRsd: number;
  itemsCount: number;
};

type OrdersApiRow = {
  order_number: string;
  status: OrderStatus;
  created_at: string;
  total_rsd: number | string;
  order_items?: Array<{ id: number | string }> | null;
};

function formatRsd(value: number) {
  return `${new Intl.NumberFormat("sr-RS").format(value)} rsd`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = getOrderStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span className={`${statusStyles.statusBadge} ${statusStyles[meta.tone]}`}>
      <Icon />
      <span>{meta.label}</span>
    </span>
  );
}

export default function MyAccount({
  userDisplayName,
  userInitials,
  userAvatarUrl,
  email,
  phone,
}: MyAccountProps) {
  const [ordersCount, setOrdersCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [addressesCount, setAddressesCount] = useState(0);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const membershipLabel = useMemo(() => {
    return ordersCount > 0 ? "Aktivan kupac" : "Član Atelier Dekant";
  }, [ordersCount]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        setLoadingSummary(true);

        const [ordersResponse, wishlistItems, addressRows] = await Promise.all([
          fetch("/api/orders/my", { cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) return [] as OrdersApiRow[];
              const data = await response.json();
              return (data?.orders ?? []) as OrdersApiRow[];
            })
            .catch(() => [] as OrdersApiRow[]),
          readWishlist().catch(() => []),
          loadAddressesRequest().catch(() => []),
        ]);

        if (cancelled) return;

        setOrdersCount(ordersResponse.length);
        setWishlistCount(wishlistItems.length);
        setAddressesCount(addressRows.length);

        const latest = ordersResponse[0];
        setLastOrder(
          latest
            ? {
                orderNumber: latest.order_number,
                status: latest.status,
                createdAt: latest.created_at,
                totalRsd: Number(latest.total_rsd ?? 0),
                itemsCount: latest.order_items?.length ?? 0,
              }
            : null
        );
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.avatarWrap}>
              {userAvatarUrl ? (
                <Image
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  width={96}
                  height={96}
                  unoptimized
                  className={styles.avatarImage}
                />
              ) : (
                <span className={styles.avatarFallback}>{userInitials}</span>
              )}
            </div>

            <div className={styles.heroText}>
              <span className={styles.eyebrow}>Moj nalog</span>

              <h1 className={styles.title}>Dobrodošao nazad, {userDisplayName}</h1>

              <p className={styles.subtitle}>
                Ovde možeš da pratiš porudžbine, uređuješ profil i brzo pristupiš
                omiljenim proizvodima.
              </p>

              <div className={styles.userMeta}>
                <span className={styles.userPill}>{email || "Bez email adrese"}</span>
                <span className={styles.userPill}>{membershipLabel}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiPackage />
            </div>
            <div>
              <div className={styles.statValue}>{loadingSummary ? "…" : ordersCount}</div>
              <div className={styles.statLabel}>Porudžbine</div>
            </div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiHeart />
            </div>
            <div>
              <div className={styles.statValue}>{loadingSummary ? "…" : wishlistCount}</div>
              <div className={styles.statLabel}>Omiljeni proizvodi</div>
            </div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiMapPin />
            </div>
            <div>
              <div className={styles.statValue}>{loadingSummary ? "…" : addressesCount}</div>
              <div className={styles.statLabel}>Sačuvane adrese</div>
            </div>
          </article>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <article className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>Brze akcije</h2>
                  <p className={styles.cardText}>Najvažnije stvari na jednom mestu.</p>
                </div>
              </div>

              <div className={styles.actionGrid}>
                <Link href="/orders" className={styles.actionCard}>
                  <div className={styles.actionLeft}>
                    <span className={styles.actionIcon}>
                      <FiPackage />
                    </span>
                    <div>
                      <div className={styles.actionTitle}>Moje porudžbine</div>
                      <div className={styles.actionText}>
                        Pregled statusa i detalja porudžbine
                      </div>
                    </div>
                  </div>
                  <FiArrowRight className={styles.actionArrow} />
                </Link>

                <Link href="/wishlist" className={styles.actionCard}>
                  <div className={styles.actionLeft}>
                    <span className={styles.actionIcon}>
                      <FiHeart />
                    </span>
                    <div>
                      <div className={styles.actionTitle}>Omiljeni</div>
                      <div className={styles.actionText}>Sačuvani proizvodi za kasnije</div>
                    </div>
                  </div>
                  <FiArrowRight className={styles.actionArrow} />
                </Link>

                <Link href="/addresses" className={styles.actionCard}>
                  <div className={styles.actionLeft}>
                    <span className={styles.actionIcon}>
                      <FiMapPin />
                    </span>
                    <div>
                      <div className={styles.actionTitle}>Adrese</div>
                      <div className={styles.actionText}>Dostava i podaci za naplatu</div>
                    </div>
                  </div>
                  <FiArrowRight className={styles.actionArrow} />
                </Link>

                <Link href="/settings" className={styles.actionCard}>
                  <div className={styles.actionLeft}>
                    <span className={styles.actionIcon}>
                      <FiSettings />
                    </span>
                    <div>
                      <div className={styles.actionTitle}>Podešavanja</div>
                      <div className={styles.actionText}>Uredi profil i nalog</div>
                    </div>
                  </div>
                  <FiArrowRight className={styles.actionArrow} />
                </Link>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>Poslednja porudžbina</h2>
                  <p className={styles.cardText}>
                    Brzi pregled najnovije porudžbine i njenog trenutnog statusa.
                  </p>
                </div>
              </div>

              {lastOrder ? (
                <div className={styles.latestOrderCard}>
                  <div className={styles.latestOrderTop}>
                    <div>
                      <div className={styles.latestOrderKicker}>Broj porudžbine</div>
                      <div className={styles.latestOrderNumber}>{lastOrder.orderNumber}</div>
                    </div>
                    <OrderStatusBadge status={lastOrder.status} />
                  </div>

                  <div className={styles.latestOrderMeta}>
                    <div className={styles.latestOrderMetaItem}>
                      <span>Datum</span>
                      <strong>{formatDate(lastOrder.createdAt)}</strong>
                    </div>
                    <div className={styles.latestOrderMetaItem}>
                      <span>Artikli</span>
                      <strong>{lastOrder.itemsCount}</strong>
                    </div>
                    <div className={styles.latestOrderMetaItem}>
                      <span>Ukupno</span>
                      <strong>{formatRsd(lastOrder.totalRsd)}</strong>
                    </div>
                  </div>

                  <Link href="/orders" className={styles.primaryBtn}>
                    Prikaži sve porudžbine
                  </Link>
                </div>
              ) : (
                <div className={styles.emptyOrder}>
                  <div className={styles.emptyOrderIcon}>
                    <FiPackage />
                  </div>

                  <div className={styles.emptyOrderTitle}>Još nema porudžbina</div>

                  <p className={styles.emptyOrderText}>
                    Kada napraviš prvu porudžbinu, ovde ćeš videti njen status,
                    datum i ukupnu cenu.
                  </p>

                  <Link href="/shop" className={styles.primaryBtn}>
                    Idi u shop
                  </Link>
                </div>
              )}
            </article>
          </div>

          <aside className={styles.sideColumn}>
            <article className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>Detalji naloga</h2>
                  <p className={styles.cardText}>Osnovne informacije korisnika.</p>
                </div>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Ime</span>
                  <span className={styles.infoValue}>{userDisplayName}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{email || "Nije dostupan"}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Telefon</span>
                  <span className={styles.infoValue}>{phone || "Nije dodat"}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Status</span>
                  <span className={styles.infoValue}>Aktivan nalog</span>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>Preporuka</h2>
                  <p className={styles.cardText}>Najkorisniji sledeći korak za tvoj nalog.</p>
                </div>
              </div>

              <div className={styles.tipBox}>
                <div className={styles.tipTitle}>Sačuvaj podrazumevanu adresu</div>
                <p className={styles.tipText}>
                  Kada sačuvaš adresu, checkout se popunjava mnogo brže i imaš
                  manje šanse za grešku pri narednoj kupovini.
                </p>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}
