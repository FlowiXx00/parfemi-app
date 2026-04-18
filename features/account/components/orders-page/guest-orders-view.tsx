"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { FiMail, FiPackage, FiSearch } from "react-icons/fi";
import styles from "./guest-orders-view.module.css";
import statusStyles from "@/shared/orders/order-status.module.css";
import {
  getOrderStatusMeta,
  type OrderStatus,
} from "@/shared/orders/order-status";

type GuestOrderItem = {
  id: string;
  perfumeName: string;
  ml: number;
  qty: number;
  lineTotalRsd: number;
};

type GuestOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  totalRsd: number;
  items: GuestOrderItem[];
};

type ApiGuestOrderItemRow = {
  id: string | number;
  perfume_name: string;
  ml: number | string;
  qty: number | string;
  line_total_rsd: number | string;
};

type ApiGuestOrderRow = {
  id: string | number;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  total_rsd: number | string;
  order_items?: ApiGuestOrderItemRow[] | null;
};

function formatRsd(value: number) {
  return `${new Intl.NumberFormat("sr-RS").format(value)} rsd`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderItemsPreview(items: GuestOrderItem[]) {
  return (
    <div className={styles.itemsPreviewList}>
      {items.map((item) => (
        <div key={item.id} className={styles.itemsPreviewRow}>
          <strong>
            {item.perfumeName} {item.ml}ml x{item.qty}
          </strong>
        </div>
      ))}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = getOrderStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span
      className={`${statusStyles.statusBadge} ${statusStyles[meta.tone]}`}
    >
      <Icon />
      <span>{meta.label}</span>
    </span>
  );
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapGuestOrderRow(row: ApiGuestOrderRow): GuestOrder {
  return {
    id: String(row.id),
    orderNumber: row.order_number,
    status: row.status,
    createdAt: row.created_at,
    totalRsd: Number(row.total_rsd ?? 0),
    items: (row.order_items ?? []).map((item) => ({
      id: String(item.id),
      perfumeName: item.perfume_name,
      ml: Number(item.ml ?? 0),
      qty: Number(item.qty ?? 0),
      lineTotalRsd: Number(item.line_total_rsd ?? 0),
    })),
  };
}

async function loadGuestOrderByNumber(
  orderNumber: string,
  email: string
): Promise<GuestOrder> {
  const response = await fetch("/api/orders/find-by-number", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ orderNumber, email }),
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        "Porudžbina nije pronađena."
    );
  }

  if (!data?.order) {
    throw new Error("Porudžbina nije pronađena.");
  }

  return mapGuestOrderRow(data.order);
}

export default function GuestOrdersView() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [foundOrder, setFoundOrder] = useState<GuestOrder | null>(null);

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedOrderNumber = orderNumber.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedOrderNumber) {
      setErrorMessage("Unesite broj porudžbine.");
      setFoundOrder(null);
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage("Unesite email korišćen pri kupovini.");
      setFoundOrder(null);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const order = await loadGuestOrderByNumber(trimmedOrderNumber, trimmedEmail);
      setFoundOrder(order);
    } catch (error) {
      const e = error as Error;
      setFoundOrder(null);
      setErrorMessage(
        e.message || "Porudžbina nije pronađena. Proverite broj i email."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <div className={styles.kicker}>Porudžbine</div>
            <h1 className={styles.title}>Pregled porudžbine</h1>
            <p className={styles.subtitle}>
              Unesite broj porudžbine i email korišćen pri kupovini kako biste
              bezbedno proverili status i detalje porudžbine.
            </p>
          </div>

          <div className={styles.heroBadge}>
            <FiPackage />
            <span>Praćenje porudžbina</span>
          </div>
        </section>

        <section className={styles.guestPromoSection}>
          <div className={styles.guestInfoCard}>
            <div className={styles.guestInfoKicker}>Za bolje iskustvo</div>
            <h3 className={styles.guestInfoTitle}>
              Prijavite se i pratite sve porudžbine na jednom mestu
            </h3>
            <p className={styles.guestInfoText}>
              Kada imate nalog, mnogo lakše pratite trenutne i prethodne
              porudžbine, čuvate omiljene proizvode i koristite sačuvane adrese
              za brži checkout. Ako već kupujete redovno, prijava vam štedi vreme
              pri svakoj narednoj porudžbini.
            </p>

            <div className={styles.guestActions}>
              <Link href="/login?next=/orders" className={styles.secondaryButton}>
                Prijavi se
              </Link>
              <Link href="/register?next=/orders" className={styles.primaryButton}>
                Napravi nalog
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionKicker}>Pretraga</div>
              <h2 className={styles.sectionTitle}>Pronađi svoju porudžbinu</h2>
            </div>
          </div>

          <form onSubmit={handleSearch} className={styles.guestSearchForm}>
            <div className={styles.searchInputWrap}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Broj porudžbine, npr. AD-611992"
                className={styles.searchInput}
              />
            </div>

            <div className={styles.searchInputWrap}>
              <FiMail className={styles.searchIcon} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email korišćen pri kupovini"
                className={styles.searchInput}
              />
            </div>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={loading}
            >
              {loading ? "Pretraga..." : "Pronađi porudžbinu"}
            </button>
          </form>

          {errorMessage ? (
            <div className={styles.emptyState}>{errorMessage}</div>
          ) : null}

          {foundOrder ? (
            <article className={styles.guestOrderCard}>
              <div className={styles.currentTop}>
                <div>
                  <div className={styles.currentKicker}>Pronađena porudžbina</div>
                  <div className={styles.currentNumber}>
                    Broj porudžbine: {foundOrder.orderNumber}
                  </div>
                  <div className={styles.currentDate}>
                    Kreirana: {formatDate(foundOrder.createdAt)}
                  </div>
                </div>

                <OrderStatusBadge status={foundOrder.status} />
              </div>

              <div className={styles.currentBody}>
                <div className={styles.currentColumn}>
                  <div className={styles.currentLabel}>Artikli</div>
                  {renderItemsPreview(foundOrder.items)}
                </div>

                <div className={styles.currentColumn}>
                  <div className={styles.currentLabel}>Ukupno</div>
                  <div className={styles.currentTotal}>
                    {formatRsd(foundOrder.totalRsd)}
                  </div>
                </div>
              </div>
            </article>
          ) : null}
        </section>
      </div>
    </main>
  );
}
