/**
 * Table: shop_settings (single row, id = 1). Readable by everyone (cached), editable by admins only.
 */
import { revalidateTag, unstable_cache } from "next/cache";
import { publicClient } from "@/db/clients/public";
import type { Db } from "@/db/types";
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from "@/features/orders/lib/shipping";

const SETTINGS_TAG = "shop-settings";

type SettingsRow = { shipping_rsd: number | null; free_shipping_from_rsd: number | null };

function mapSettings(row: SettingsRow | null): ShopSettings {
  if (!row) return DEFAULT_SHOP_SETTINGS;
  return {
    shippingRsd: Math.max(0, Number(row.shipping_rsd ?? DEFAULT_SHOP_SETTINGS.shippingRsd)),
    freeShippingFromRsd: row.free_shipping_from_rsd ? Number(row.free_shipping_from_rsd) : null,
  };
}

/** Shop settings (5 min cache, refreshed right after an admin change). */
export const getShopSettings = unstable_cache(
  async (): Promise<ShopSettings> => {
    const { data, error } = await publicClient
      .from("shop_settings")
      .select("shipping_rsd, free_shipping_from_rsd")
      .eq("id", 1)
      .maybeSingle<SettingsRow>();
    if (error) {
      console.error("Podešavanja nisu učitana:", error.message);
      return DEFAULT_SHOP_SETTINGS;
    }
    return mapSettings(data);
  },
  ["shop-settings"],
  { tags: [SETTINGS_TAG], revalidate: 300 }
);

/** Fresh from the database (orders: the shipping price must be exact at the time of purchase). */
export async function readShopSettingsFresh(db: Db): Promise<ShopSettings> {
  const { data } = await db
    .from("shop_settings")
    .select("shipping_rsd, free_shipping_from_rsd")
    .eq("id", 1)
    .maybeSingle<SettingsRow>();
  return mapSettings(data);
}

export async function updateShopSettings(db: Db, settings: ShopSettings) {
  return await db
    .from("shop_settings")
    .update({
      shipping_rsd: settings.shippingRsd,
      free_shipping_from_rsd: settings.freeShippingFromRsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
}

export function revalidateShopSettings() {
  revalidateTag(SETTINGS_TAG, { expire: 0 });
}
