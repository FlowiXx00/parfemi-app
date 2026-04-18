"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./orders.module.css";

import {
  calculateOrderStats,
  formatDate,
  formatRsd,
  getStatusLabel,
} from "../../lib/orders.lib";

import type {
  AdminOrderFilterStatus,
  AdminOrderNextStatus,
  OrderRow,
  OrderStatus,
} from "../../types";

import {
  AdminOrdersApiError,
  loadOrders,
  updateOrderStatusRequest,
} from "../../client/orders.api";

function getStatusClass(status: OrderStatus) {
  if (status === "pending") return styles.statusPending;
  if (status === "confirmed") return styles.statusConfirmed;
  if (status === "shipped") return styles.statusShipped;
  return styles.statusCancelled;
}

function getStatusDescription(status: OrderStatus) {
  if (status === "pending") {
    return "Porudžbina je nova i čeka proveru dostupnosti proizvoda.";
  }

  if (status === "confirmed") {
    return "Porudžbina je potvrđena i priprema se za slanje.";
  }

  if (status === "shipped") {
    return "Pošiljka je predata kuriru i poslata kupcu.";
  }

  return "Porudžbina je otkazana nakon provere ili kontakta sa kupcem.";
}

const StatusBadge = memo(function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`${styles.statusBadge} ${getStatusClass(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
});

const OrderActions = memo(function OrderActions({
  order,
  isBusy,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  order: OrderRow;
  isBusy: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (nextStatus: AdminOrderNextStatus) => void;
}) {
  return (
    <div className={styles.orderActions}>
      <button
        type="button"
        className={styles.ghostButton}
        onClick={onToggle}
      >
        {isExpanded ? "Sakrij detalje" : "Prikaži detalje"}
      </button>

      {order.status === "pending" && (
        <>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isBusy}
            onClick={() => onUpdate("confirmed")}
          >
            {isBusy ? "Obrađujem..." : "Potvrdi"}
          </button>

          <button
            type="button"
            className={styles.dangerButton}
            disabled={isBusy}
            onClick={() => onUpdate("cancelled")}
          >
            {isBusy ? "Obrađujem..." : "Otkaži"}
          </button>
        </>
      )}

      {order.status === "confirmed" && (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isBusy}
          onClick={() => onUpdate("shipped")}
        >
          {isBusy ? "Obrađujem..." : "Označi kao poslato"}
        </button>
      )}

      {order.status === "shipped" && (
        <div className={styles.doneLabel}>Porudžbina je poslata</div>
      )}

      {order.status === "cancelled" && (
        <div className={styles.cancelledLabel}>Porudžbina je otkazana</div>
      )}
    </div>
  );
});

export default function AdminOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminOrderFilterStatus>("all");

  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const hasLoadedRef = useRef(false);

  const handleApiError = useCallback(
    (error: unknown) => {
      if (error instanceof AdminOrdersApiError) {
        if (error.status === 401) {
          router.replace("/login");
          return true;
        }

        if (error.status === 403) {
          router.replace("/");
          return true;
        }
      }

      return false;
    },
    [router]
  );

  const handleLoadOrders = useCallback(async () => {
    if (hasLoadedRef.current) {
      setIsFetching(true);
    } else {
      setInitialLoading(true);
    }

    setErrorMessage("");

    try {
      const rows = await loadOrders(status, query);
      setOrders(rows);
      hasLoadedRef.current = true;
    } catch (error) {
      if (handleApiError(error)) return;

      console.error("ADMIN ORDERS LOAD ERROR:", error);
      setOrders([]);

      const e = error as Error;
      setErrorMessage(e.message || "Greška pri učitavanju porudžbina.");
    } finally {
      setInitialLoading(false);
      setIsFetching(false);
    }
  }, [handleApiError, query, status]);

  async function handleUpdateOrderStatus(
    id: number,
    nextStatus: AdminOrderNextStatus
  ) {
    try {
      setActionLoadingId(id);
      await updateOrderStatusRequest(id, nextStatus);
      await handleLoadOrders();
    } catch (error) {
      if (handleApiError(error)) return;

      console.error("UPDATE ORDER STATUS ERROR:", error);

      const e = error as Error;
      alert(e.message || "Greška pri ažuriranju statusa.");
    } finally {
      setActionLoadingId(null);
    }
  }

  function toggleExpandedOrder(id: number) {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void handleLoadOrders();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [handleLoadOrders]);

  const stats = useMemo(() => calculateOrderStats(orders), [orders]);

  if (initialLoading) {
    return <div className={styles.loading}>Učitavanje porudžbina...</div>;
  }

  return (
    <main className={`${styles.page} ui-page-glass`}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Admin panel</p>
            <h1 className={styles.title}>Porudžbine</h1>
            <p className={styles.subtitle}>
              Pregled novih, potvrđenih, poslatih i otkazanih porudžbina sa
              brzom pretragom po broju porudžbine.
            </p>
          </div>
        </section>

        <section className={styles.statsGrid}>
          <article className={`${styles.statCard} ui-glass-card`}>
            <span className={styles.statLabel}>Ukupno u prikazu</span>
            <strong className={styles.statValue}>{stats.totalOrders}</strong>
          </article>

          <article className={`${styles.statCard} ui-glass-card`}>
            <span className={styles.statLabel}>Ukupan iznos</span>
            <strong className={styles.statValue}>
              {formatRsd(stats.totalRevenue)}
            </strong>
          </article>

          <article className={`${styles.statCard} ui-glass-card`}>
            <span className={styles.statLabel}>Nove porudžbine</span>
            <strong className={styles.statValue}>{stats.pendingCount}</strong>
          </article>

          <article className={`${styles.statCard} ui-glass-card`}>
            <span className={styles.statLabel}>Potvrđene</span>
            <strong className={styles.statValue}>{stats.confirmedCount}</strong>
          </article>
        </section>

        <section className={styles.toolbarCard}>
          <div className={styles.toolbarTop}>
            <div>
              <h2 className={styles.sectionTitle}>Pretraga i filteri</h2>
              <p className={styles.sectionText}>
                Pretraži porudžbine po broju porudžbine i filtriraj po statusu.
              </p>
              {isFetching && (
                <p className={styles.fetchingText}>Osvežavam rezultate...</p>
              )}
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pretraga po order number, npr. AD-611975"
                className={styles.input}
              />
            </div>

            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AdminOrderFilterStatus)
              }
              className={styles.select}
            >
              <option value="all">Sve porudžbine</option>
              <option value="pending">Nove</option>
              <option value="confirmed">Potvrđene</option>
              <option value="shipped">Poslate</option>
              <option value="cancelled">Otkazane</option>
            </select>
          </div>
        </section>

        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        {orders.length === 0 ? (
          <section className={styles.emptyCard}>
            <p className={styles.emptyTitle}>Nema porudžbina za prikaz.</p>
            <p className={styles.emptyText}>
              Promeni status filter ili pokušaj drugu pretragu po broju
              porudžbine.
            </p>
          </section>
        ) : (
          <section className={styles.ordersGrid}>
            {orders.map((order) => {
              const isBusy = actionLoadingId === order.id;
              const isExpanded = expandedOrderId === order.id;

              return (
                <article key={order.id} className={styles.orderCard}>
                  <div className={styles.orderTopRow}>
                    <div className={styles.orderTopMain}>
                      <div className={styles.orderNumber}>{order.order_number}</div>
                      <div className={styles.orderCustomer}>
                        {order.customer_full_name}
                      </div>
                      <div className={styles.orderDate}>
                        Porudžbina kreirana {formatDate(order.created_at)}
                      </div>
                    </div>

                    <div className={styles.orderTopSide}>
                      <StatusBadge status={order.status} />
                      <div className={styles.orderTotalValue}>
                        {formatRsd(order.total_rsd)}
                      </div>
                    </div>
                  </div>

                  <div className={styles.orderStatusNote}>
                    {getStatusDescription(order.status)}
                  </div>

                  <OrderActions
                    order={order}
                    isBusy={isBusy}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpandedOrder(order.id)}
                    onUpdate={(nextStatus) =>
                      handleUpdateOrderStatus(order.id, nextStatus)
                    }
                  />

                  {isExpanded && (
                    <div className={styles.detailsPanel}>
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailsCard}>
                          <h3 className={styles.detailsTitle}>Kupac</h3>
                          <div className={styles.detailsList}>
                            <p>
                              <span>Ime i prezime:</span>{" "}
                              <strong>{order.customer_full_name}</strong>
                            </p>
                            <p>
                              <span>Email:</span>{" "}
                              <strong>{order.customer_email}</strong>
                            </p>
                            <p>
                              <span>Telefon:</span>{" "}
                              <strong>{order.customer_phone}</strong>
                            </p>
                            <p>
                              <span>Grad:</span>{" "}
                              <strong>{order.customer_city}</strong>
                            </p>
                            <p>
                              <span>Adresa:</span>{" "}
                              <strong>{order.customer_address}</strong>
                            </p>
                          </div>
                        </div>

                        <div className={styles.detailsCard}>
                          <h3 className={styles.detailsTitle}>Napomena</h3>
                          <div className={styles.detailsList}>
                            <p>
                              <span>Status:</span>{" "}
                              <strong>{getStatusLabel(order.status)}</strong>
                            </p>
                            <p>
                              <span>Napomena kupca:</span>{" "}
                              <strong>
                                {order.customer_note?.trim()
                                  ? order.customer_note
                                  : "Nema napomene"}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className={styles.detailsCard}>
                          <h3 className={styles.detailsTitle}>Obračun</h3>
                          <div className={styles.detailsList}>
                            <p>
                              <span>Kupon:</span>{" "}
                              <strong>{order.coupon_code || "Nema"}</strong>
                            </p>
                            <p>
                              <span>Subtotal:</span>{" "}
                              <strong>{formatRsd(order.subtotal_rsd)}</strong>
                            </p>
                            <p>
                              <span>Popust:</span>{" "}
                              <strong>- {formatRsd(order.discount_rsd)}</strong>
                            </p>
                            <p>
                              <span>Dostava:</span>{" "}
                              <strong>{formatRsd(order.shipping_rsd)}</strong>
                            </p>
                            <p>
                              <span>Ukupno:</span>{" "}
                              <strong>{formatRsd(order.total_rsd)}</strong>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={styles.itemsBlock}>
                        <h3 className={styles.detailsTitle}>Poručeni proizvodi</h3>

                        {order.order_items?.length ? (
                          <div className={styles.itemsTable}>
                            {order.order_items.map((item) => (
                              <div key={item.id} className={styles.itemRow}>
                                <div className={styles.itemMain}>
                                  <div className={styles.itemName}>
                                    {item.perfume_name}
                                  </div>
                                  <div className={styles.itemMeta}>
                                    {item.ml} ml · {formatRsd(item.price_rsd)} /
                                    kom
                                  </div>
                                </div>

                                <div className={styles.itemQty}>x{item.qty}</div>
                                <div className={styles.itemTotal}>
                                  {formatRsd(item.line_total_rsd)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.noItems}>
                            Nema stavki za ovu porudžbinu.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}