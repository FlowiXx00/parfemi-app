"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  FiBox,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiPackage,
  FiSearch,
  FiShoppingBag,
} from "react-icons/fi";
import styles from "./logged-in-orders-view.module.css";
import statusStyles from "@/shared/orders/order-status.module.css";
import {
  getOrderStatusMeta,
  type OrderStatus,
} from "@/shared/orders/order-status";

type OrderItem = {
  id: string;
  perfumeId: string;
  perfumeName: string;
  perfumeBrand: string;
  imageUrl: string | null;
  ml: number;
  qty: number;
  priceRsd: number;
  lineTotalRsd: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  receivedAt?: string | null;
  customerNote?: string | null;
  subtotalRsd: number;
  shippingRsd: number;
  totalRsd: number;
  items: OrderItem[];
};

type ApiOrderItemRow = {
  id: string | number;
  perfume_id: string;
  perfume_name: string;
  perfume_brand: string | null;
  image_url: string | null;
  ml: number | string;
  qty: number | string;
  price_rsd: number | string;
  line_total_rsd: number | string;
};

type ApiOrderRow = {
  id: string | number;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  received_at?: string | null;
  customer_note?: string | null;
  subtotal_rsd: number | string;
  shipping_rsd: number | string;
  total_rsd: number | string;
  order_items?: ApiOrderItemRow[] | null;
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

function renderItemsPreview(items: OrderItem[]) {
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

function chunkOrders<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}

const OrderStatusBadge = memo(function OrderStatusBadge({ status }: { status: OrderStatus }) {
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
});

const ProgressSteps = memo(function ProgressSteps({ status }: { status: OrderStatus }) {
  const progress = getOrderStatusMeta(status).progress;

  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressRow}>
        <div className={styles.progressItem}>
          <span
            className={`${styles.progressDot} ${
              progress >= 1 ? styles.progressDotActive : ""
            }`}
          />
          <span className={styles.progressLabel}>Nova</span>
        </div>

        <span
          className={`${styles.progressLine} ${
            progress >= 2 ? styles.progressLineActive : ""
          }`}
        />

        <div className={styles.progressItem}>
          <span
            className={`${styles.progressDot} ${
              progress >= 2 ? styles.progressDotActive : ""
            }`}
          />
          <span className={styles.progressLabel}>Potvrđena</span>
        </div>

        <span
          className={`${styles.progressLine} ${
            progress >= 3 ? styles.progressLineActive : ""
          }`}
        />

        <div className={styles.progressItem}>
          <span
            className={`${styles.progressDot} ${
              progress >= 3 ? styles.progressDotActive : ""
            }`}
          />
          <span className={styles.progressLabel}>Poslata</span>
        </div>

        <span
          className={`${styles.progressLine} ${
            progress >= 4 ? styles.progressLineActive : ""
          }`}
        />

        <div className={styles.progressItem}>
          <span
            className={`${styles.progressDot} ${
              progress >= 4 ? styles.progressDotActive : ""
            }`}
          />
          <span className={styles.progressLabel}>Preuzeta</span>
        </div>
      </div>
    </div>
  );
});

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapOrderRow(row: ApiOrderRow): Order {
  return {
    id: String(row.id),
    orderNumber: row.order_number,
    status: row.status,
    createdAt: row.created_at,
    receivedAt: row.received_at ?? null,
    customerNote: row.customer_note ?? null,
    subtotalRsd: Number(row.subtotal_rsd ?? 0),
    shippingRsd: Number(row.shipping_rsd ?? 0),
    totalRsd: Number(row.total_rsd ?? 0),
    items: (row.order_items ?? []).map((item) => ({
      id: String(item.id),
      perfumeId: item.perfume_id,
      perfumeName: item.perfume_name,
      perfumeBrand: item.perfume_brand ?? "",
      imageUrl:
        typeof item.image_url === "string" && item.image_url.trim().length > 0
          ? item.image_url
          : null,
      ml: Number(item.ml ?? 0),
      qty: Number(item.qty ?? 0),
      priceRsd: Number(item.price_rsd ?? 0),
      lineTotalRsd: Number(item.line_total_rsd ?? 0),
    })),
  };
}

async function loadMyOrders(): Promise<Order[]> {
  const response = await fetch("/api/orders/my", {
    method: "GET",
    cache: "no-store",
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        "Greška pri učitavanju porudžbina."
    );
  }

  return Array.isArray(data?.orders) ? data.orders.map(mapOrderRow) : [];
}

async function markOrderAsReceived(orderId: string) {
  const response = await fetch("/api/orders/received", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        "Greška pri potvrdi preuzimanja pošiljke."
    );
  }
}

export default function LoggedInOrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErrorMessage("");

        const rows = await loadMyOrders();

        if (cancelled) return;

        setOrders(rows);
        setExpandedOrderId(null);
      } catch (error) {
        if (cancelled) return;

        const e = error as Error;
        setOrders([]);
        setErrorMessage(e.message || "Greška pri učitavanju porudžbina.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshOrders = useCallback(async () => {
    const rows = await loadMyOrders();
    setOrders(rows);

    setExpandedOrderId((prev) => {
      if (prev && rows.some((order) => order.id === prev)) {
        return prev;
      }
      return null;
    });
  }, []);

  const handleMarkReceived = useCallback(async (orderId: string) => {
    try {
      setBusyOrderId(orderId);
      await markOrderAsReceived(orderId);
      await refreshOrders();
    } catch (error) {
      console.error("MARK ORDER RECEIVED ERROR:", error);
      const e = error as Error;
      alert(e.message || "Greška pri potvrdi preuzimanja pošiljke.");
    } finally {
      setBusyOrderId(null);
    }
  }, [refreshOrders]);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "pending" ||
          order.status === "confirmed" ||
          order.status === "shipped"
      ),
    [orders]
  );

  const historyOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "received" || order.status === "cancelled"
      ),
    [orders]
  );

  const receivedOrders = useMemo(
    () => orders.filter((order) => order.status === "received"),
    [orders]
  );

  const filteredActiveOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return activeOrders;

    return activeOrders.filter((order) =>
      order.orderNumber.toLowerCase().includes(query)
    );
  }, [activeOrders, searchTerm]);

  const filteredHistoryOrders = useMemo(() => {
    const query = historySearchTerm.trim().toLowerCase();

    if (!query) return historyOrders;

    return historyOrders.filter((order) =>
      order.orderNumber.toLowerCase().includes(query)
    );
  }, [historyOrders, historySearchTerm]);

  const activeSlides = useMemo(
    () => chunkOrders(filteredActiveOrders, 2),
    [filteredActiveOrders]
  );

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [searchTerm, filteredActiveOrders.length]);

  useEffect(() => {
    setActiveSlideIndex((prev) =>
      Math.min(prev, Math.max(activeSlides.length - 1, 0))
    );
  }, [activeSlides.length]);

  useEffect(() => {
    setExpandedOrderId((prev) => {
      if (!prev) return prev;

      const existsInFiltered = filteredHistoryOrders.some(
        (order) => order.id === prev
      );

      return existsInFiltered ? prev : null;
    });
  }, [filteredHistoryOrders]);

  const totalOrders = receivedOrders.length;

  const totalSpent = receivedOrders.reduce(
    (sum, order) => sum + order.totalRsd,
    0
  );

  const totalItemsBought = receivedOrders.reduce(
    (sum, order) =>
      sum + order.items.reduce((inner, item) => inner + item.qty, 0),
    0
  );

  const lastOrderDate = orders[0] ? formatDate(orders[0].createdAt) : "-";

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <section className={styles.listSection}>
            <div className={styles.emptyState}>Učitavanje porudžbina...</div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <div className={styles.kicker}>Moj nalog</div>
            <h1 className={styles.title}>Trenutne porudžbine</h1>
            <p className={styles.subtitle}>
              Ovde možete videti vaše porudžbine koje su trenutno u procesu.
            </p>
          </div>

          <div className={styles.heroBadge}>
            <FiPackage />
            <span>Praćenje porudžbina</span>
          </div>
        </section>

        <section className={styles.activeSection}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionKicker}>Aktivno</div>
              <h2 className={styles.sectionTitle}>Aktivne porudžbine</h2>
            </div>
          </div>

          <div className={styles.activeToolbar}>
            <div className={styles.searchInputWrap}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pretraži po broju porudžbine..."
                className={styles.searchInput}
              />
            </div>

            {activeSlides.length > 1 && (
              <div className={styles.sliderPanel}>
                <button
                  type="button"
                  className={styles.sliderButton}
                  onClick={() =>
                    setActiveSlideIndex((prev) => Math.max(prev - 1, 0))
                  }
                  disabled={activeSlideIndex === 0}
                  aria-label="Prethodne porudžbine"
                >
                  <FiChevronLeft />
                </button>

                <div className={styles.sliderTrackWrap}>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(activeSlides.length - 1, 0)}
                    step={1}
                    value={activeSlideIndex}
                    onChange={(e) =>
                      setActiveSlideIndex(Number(e.target.value))
                    }
                    className={styles.sliderRange}
                    aria-label="Klizač za aktivne porudžbine"
                  />

                  <div className={styles.sliderMeta}>
                    <span>Prikaz porudžbina</span>
                    <span>
                      {activeSlideIndex + 1} / {activeSlides.length}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.sliderButton}
                  onClick={() =>
                    setActiveSlideIndex((prev) =>
                      Math.min(prev + 1, activeSlides.length - 1)
                    )
                  }
                  disabled={activeSlideIndex === activeSlides.length - 1}
                  aria-label="Sledeće porudžbine"
                >
                  <FiChevronRight />
                </button>
              </div>
            )}
          </div>

          {filteredActiveOrders.length === 0 ? (
            <div className={styles.emptyState}>
              Nema aktivnih porudžbina za uneti broj.
            </div>
          ) : (
            <div className={styles.activeSliderViewport}>
              <div className={styles.activeOrdersGrid}>
                {(activeSlides[activeSlideIndex] ?? []).map((order) => {
                  const statusMeta = getOrderStatusMeta(order.status);

                  return (
                    <article key={order.id} className={styles.currentOrderCard}>
                      <div className={styles.currentTop}>
                        <div>
                          <div className={styles.currentKicker}>
                            Aktivna porudžbina
                          </div>
                          <div className={styles.currentNumber}>
                            Broj porudžbine: {order.orderNumber}
                          </div>
                          <div className={styles.currentDate}>
                            Kreirana: {formatDate(order.createdAt)}
                          </div>
                        </div>
                      </div>

                      <p className={styles.currentDescription}>
                        {statusMeta.description}
                      </p>

                      <div className={styles.currentPurchased}>
                        <span className={styles.currentPurchasedLabel}>
                          Kupljeno:
                        </span>
                        <div className={styles.currentPurchasedText}>
                          {renderItemsPreview(order.items)}
                        </div>
                      </div>

                      <div className={styles.currentFooter}>
                        <div className={styles.progressHeader}>
                          <span className={styles.progressTitle}>
                            Status porudžbine
                          </span>
                          <span
                            className={`${statusStyles.statusBadge} ${statusStyles.statusPill} ${statusStyles[statusMeta.tone]}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>

                        <ProgressSteps status={order.status} />

                        <div className={styles.currentMeta}>
                          <div className={styles.currentMetaItem}>
                            <span className={styles.currentMetaLabel}>
                              Stavki
                            </span>
                            <span className={styles.currentMetaValue}>
                              {order.items.reduce(
                                (sum, item) => sum + item.qty,
                                0
                              )}
                            </span>
                          </div>

                          <div className={styles.currentMetaItem}>
                            <span className={styles.currentMetaLabel}>
                              Ukupno
                            </span>
                            <span className={styles.currentMetaValue}>
                              {formatRsd(order.totalRsd)}
                            </span>
                          </div>
                        </div>

                        <div className={styles.currentActionWrap}>
                          {order.status === "shipped" ? (
                            <button
                              type="button"
                              className={styles.receivedButton}
                              disabled={busyOrderId === order.id}
                              onClick={() => handleMarkReceived(order.id)}
                            >
                              {busyOrderId === order.id
                                ? "Potvrđujem..."
                                : "Pošiljka preuzeta"}
                            </button>
                          ) : (
                            <div
                              className={styles.currentActionPlaceholder}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiShoppingBag />
            </div>
            <div className={styles.statValue}>{totalOrders}</div>
            <div className={styles.statLabel}>Ukupno preuzetih porudžbina</div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiBox />
            </div>
            <div className={styles.statValue}>{totalItemsBought}</div>
            <div className={styles.statLabel}>Kupljenih artikala</div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiCheckCircle />
            </div>
            <div className={styles.statValue}>{formatRsd(totalSpent)}</div>
            <div className={styles.statLabel}>Ukupno potrošeno</div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statIcon}>
              <FiClock />
            </div>
            <div className={styles.statValueSmall}>{lastOrderDate}</div>
            <div className={styles.statLabel}>Poslednja porudžbina</div>
          </article>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionKicker}>Pregled</div>
              <h2 className={styles.sectionTitle}>Istorija porudžbina</h2>
            </div>
          </div>

          <div className={styles.activeToolbar}>
            <div className={styles.searchInputWrap}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Pretraži istoriju po broju porudžbine..."
                className={styles.searchInput}
              />
            </div>
          </div>

          {errorMessage ? (
            <div className={styles.emptyState}>{errorMessage}</div>
          ) : filteredHistoryOrders.length === 0 ? (
            <div className={styles.emptyState}>
              Nema porudžbina za uneti broj.
            </div>
          ) : (
            <div className={styles.orderList}>
              {filteredHistoryOrders.map((order) => {
                const expanded = expandedOrderId === order.id;
                const itemCount = order.items.reduce(
                  (sum, item) => sum + item.qty,
                  0
                );

                return (
                  <article key={order.id} className={styles.orderCard}>
                    <button
                      type="button"
                      className={styles.orderSummary}
                      onClick={() =>
                        setExpandedOrderId((prev) =>
                          prev === order.id ? null : order.id
                        )
                      }
                      aria-expanded={expanded}
                    >
                      <div className={styles.orderSummaryLeft}>
                        <div className={styles.orderNumber}>
                          {order.orderNumber}
                        </div>
                        <div className={styles.orderDate}>
                          {formatDate(order.createdAt)}
                        </div>
                      </div>

                      <div className={styles.orderSummaryCenter}>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      <div className={styles.orderSummaryRight}>
                        <div className={styles.orderTotal}>
                          {formatRsd(order.totalRsd)}
                        </div>
                        <div className={styles.orderItemsCount}>
                          {itemCount} {itemCount === 1 ? "stavka" : "stavki"}
                        </div>
                      </div>

                      <span
                        className={`${styles.chevron} ${
                          expanded ? styles.chevronOpen : ""
                        }`}
                      >
                        <FiChevronDown />
                      </span>
                    </button>

                    {expanded && (
                      <div className={styles.orderDetails}>
                        <div className={styles.itemsList}>
                          {order.items.map((item) => (
                            <div key={item.id} className={styles.itemRow}>
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.perfumeName}
                                  width={72}
                                  height={72}
                                  unoptimized
                                  className={styles.itemImage}
                                />
                              ) : (
                                <div className={styles.itemImagePlaceholder}>
                                  {item.perfumeName.charAt(0).toUpperCase()}
                                </div>
                              )}

                              <div className={styles.itemInfo}>
                                <div className={styles.itemBrand}>
                                  {item.perfumeBrand}
                                </div>
                                <div className={styles.itemName}>
                                  {item.perfumeName}
                                </div>
                                <div className={styles.itemMeta}>
                                  {item.ml}ml · Količina: {item.qty}
                                </div>
                              </div>

                              <div className={styles.itemPrice}>
                                {formatRsd(item.lineTotalRsd)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={styles.detailsFooter}>
                          <div className={styles.noteBlock}>
                            <div className={styles.noteTitle}>Napomena</div>
                            <div className={styles.noteText}>
                              {order.customerNote || "Nema dodatne napomene."}
                            </div>
                          </div>

                          <div className={styles.totalsBox}>
                            <div className={styles.totalRow}>
                              <span>Međuzbir</span>
                              <span>{formatRsd(order.subtotalRsd)}</span>
                            </div>
                            <div className={styles.totalRow}>
                              <span>Dostava</span>
                              <span>{formatRsd(order.shippingRsd)}</span>
                            </div>
                            <div
                              className={`${styles.totalRow} ${styles.totalRowStrong}`}
                            >
                              <span>Ukupno</span>
                              <span>{formatRsd(order.totalRsd)}</span>
                            </div>

                            {order.status === "received" && (
                              <div className={styles.receivedInfo}>
                                Pošiljka je preuzeta
                                {order.receivedAt
                                  ? ` · ${formatDate(order.receivedAt)}`
                                  : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
