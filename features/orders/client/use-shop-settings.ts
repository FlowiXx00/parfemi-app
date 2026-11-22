"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from "@/features/orders/lib/shipping";

let settingsPromise: Promise<ShopSettings> | null = null;

/** One request per visit (shared by the cart page, drawer and product page). */
function loadSettings(): Promise<ShopSettings> {
  if (!settingsPromise) {
    settingsPromise = fetch("/api/shop-settings")
      .then((response) => (response.ok ? response.json() : DEFAULT_SHOP_SETTINGS))
      .then((data: Partial<ShopSettings>) => ({
        shippingRsd: Number.isFinite(Number(data.shippingRsd)) ? Number(data.shippingRsd) : DEFAULT_SHOP_SETTINGS.shippingRsd,
        freeShippingFromRsd: data.freeShippingFromRsd ? Number(data.freeShippingFromRsd) : null,
      }))
      .catch(() => {
        settingsPromise = null; // try again next time
        return DEFAULT_SHOP_SETTINGS;
      });
  }
  return settingsPromise;
}

/** Shipping settings in the browser (defaults until they arrive). */
export function useShopSettings(): ShopSettings {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);

  useEffect(() => {
    let alive = true;
    void loadSettings().then((loaded) => {
      if (alive) setSettings(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  return settings;
}
