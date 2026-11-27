/**
 * "Javi mi kad bude na stanju": which waiting alerts can be sent now. Pure logic (tested).
 *
 * An alert without a volume waits for any volume of the perfume, an alert with a volume waits for
 * that volume. One customer gets one email per perfume, even with several alerts for it.
 */

export type WaitingAlert = { id: string; user_id: string; perfume_id: string; ml: number | null };

export type DueNotification = {
  userId: string;
  perfumeId: string;
  alertIds: string[];
  /** Volumes worth mentioning in the email (available ones the customer cares about). */
  volumes: number[];
};

/** `available` = available volumes (ml) per perfume, right now. */
export function dueNotifications(alerts: WaitingAlert[], available: Map<string, number[]>): DueNotification[] {
  const groups = new Map<string, DueNotification>();

  for (const alert of alerts) {
    const volumes = available.get(alert.perfume_id) ?? [];
    if (!volumes.length) continue;
    if (alert.ml !== null && !volumes.includes(alert.ml)) continue;

    const key = `${alert.user_id}|${alert.perfume_id}`;
    const group = groups.get(key) ?? { userId: alert.user_id, perfumeId: alert.perfume_id, alertIds: [], volumes: [] };
    group.alertIds.push(alert.id);
    for (const ml of alert.ml === null ? volumes : [alert.ml]) {
      if (!group.volumes.includes(ml)) group.volumes.push(ml);
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({ ...group, volumes: [...group.volumes].sort((a, b) => a - b) }));
}

/** Volumes the customer can ask about: the ones that aren't available now. */
export function unavailableVolumes(variants: { ml: number; inStock: boolean }[]) {
  return variants.filter((variant) => !variant.inStock).map((variant) => variant.ml);
}
