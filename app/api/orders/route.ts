import { after, NextRequest, NextResponse } from "next/server";
import { sendNewOrderEmails } from "@/features/notifications/server/order-emails";
import { protectMutationRoute } from "@/lib/request-security";
import { createClient } from "@/db/clients/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { buildIpsPayment, readIpsConfig } from "@/features/orders/server/ips-payment";
import { formatAccount, referenceFromOrderNumber } from "@/features/orders/lib/ips-qr";
import {
  deleteOrderById,
  insertOrder,
  insertOrderItems,
} from "@/db/queries/orders";
import { listPerfumesByIds, revalidateCatalog } from "@/db/queries/perfumes";
import { consumeStock, readStockMap, releaseStock, variantAvailable } from "@/db/queries/stock";
import { getBundle } from "@/db/queries/bundles";
import {
  CUSTOM_BUNDLE_MAX,
  CUSTOM_BUNDLE_MIN,
  CUSTOM_BUNDLE_ML,
  CUSTOM_BUNDLE_PREFIX,
  customBundleDiscount,
  parseBundleCartId,
  parseCustomBundleCartId,
  priceBundle,
  type BundleRow,
} from "@/features/bundles/lib/bundles";
import { getCouponByCode, redeemCoupon, releaseCoupon } from "@/db/queries/coupons";
import { shippingFor } from "@/features/orders/lib/shipping";
import { readShopSettingsFresh } from "@/db/queries/settings";
import { fullProductName } from "@/features/shop/lib/product-name";
import {
  checkCoupon,
  getCouponDiscount,
  normalizeCouponCode,
  type Coupon,
} from "@/features/orders/lib/coupons";
import { cleanText, isValidEmail } from "@/lib/validation";

type IncomingItem = {
  id: string;
  ml: number;
  qty: number;
};

type CustomerPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  note?: string;
};

type OrderPayload = {
  customer?: CustomerPayload;
  items?: unknown;
  couponCode?: unknown;
};

const MAX_DISTINCT_ITEMS = 30;
const MAX_ITEM_QTY = 20;

function normalizeItems(items: unknown): IncomingItem[] {
  if (!Array.isArray(items)) return [];

  const grouped = new Map<string, IncomingItem>();

  for (const raw of items) {
    const row =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};

    const id = typeof row.id === "string" ? row.id.trim() : "";
    const ml = Number(row.ml);
    const qty = Number(row.qty);

    if (!id) continue;
    if (!Number.isFinite(ml) || ml <= 0) continue;
    if (!Number.isInteger(qty) || qty <= 0) continue;

    const key = `${id}__${ml}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.qty += qty;
    } else {
      grouped.set(key, { id, ml, qty });
    }
  }

  return Array.from(grouped.values());
}

type PerfumeRow = {
  id: string;
  name: string;
  brand: string | null;
  variants: Array<{
    ml: number;
    price_rsd: number;
    in_stock: boolean;
  }>;
};

export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "orders-create",
    limit: 6,
    windowMs: 10 * 60_000,
  });

  if (protection) {
    return protection;
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = (await req.json()) as OrderPayload;

    const customer = body.customer ?? {};
    const items = normalizeItems(body.items);
    const couponCodeInput = cleanText(body.couponCode);

    const fullName = cleanText(customer.fullName);
    const email = cleanText(customer.email).toLowerCase();
    const phone = cleanText(customer.phone);
    const city = cleanText(customer.city);
    const address = cleanText(customer.address);
    const note = cleanText(customer.note);

    if (!fullName || !email || !phone || !city || !address) {
      return NextResponse.json(
        { error: "Sva obavezna polja za dostavu moraju biti popunjena." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Email adresa nije ispravna." },
        { status: 400 }
      );
    }

    if (!items.length) {
      return NextResponse.json(
        { error: "Korpa je prazna." },
        { status: 400 }
      );
    }

    if (items.length > MAX_DISTINCT_ITEMS) {
      return NextResponse.json(
        { error: "Previše različitih stavki u porudžbini." },
        { status: 400 }
      );
    }

    if (items.some((item) => item.qty > MAX_ITEM_QTY)) {
      return NextResponse.json(
        { error: "Količina po stavci je prevelika." },
        { status: 400 }
      );
    }

    // Discovery bundles ("paket:<id>") are expanded into perfumes; the bundle price comes from current
    // prices.
    const bundles = new Map<string, BundleRow>();
    for (const bundleId of new Set(items.map((item) => parseBundleCartId(item.id)).filter(Boolean) as string[])) {
      const { data: bundle } = await getBundle(supabaseAdmin, bundleId);
      if (!bundle || !bundle.is_active) {
        return NextResponse.json(
          { error: "Paket iz korpe više nije u ponudi — ukloni ga iz korpe i pokušaj ponovo." },
          { status: 400 }
        );
      }
      bundles.set(bundleId, bundle);
    }

    // Build-your-own bundle ("mojpaket:a+b+c"): the customer picks 3–5 perfumes of the same volume.
    const isCustomBundle = (id: string) => id.startsWith(CUSTOM_BUNDLE_PREFIX);
    for (const item of items) {
      if (isCustomBundle(item.id) && (!parseCustomBundleCartId(item.id) || !(CUSTOM_BUNDLE_ML as readonly number[]).includes(item.ml))) {
        return NextResponse.json(
          { error: `Tvoj paket mora imati ${CUSTOM_BUNDLE_MIN}–${CUSTOM_BUNDLE_MAX} različitih parfema od 5 ili 10 ml. Ukloni ga iz korpe i složi ponovo.` },
          { status: 400 }
        );
      }
    }

    const perfumeIds = Array.from(
      new Set([
        ...items.filter((item) => !parseBundleCartId(item.id) && !isCustomBundle(item.id)).map((item) => item.id),
        ...[...bundles.values()].flatMap((bundle) => bundle.perfume_ids),
        ...items.flatMap((item) => parseCustomBundleCartId(item.id) ?? []),
      ])
    );

    const [{ data: perfumes, error: perfumesError }, stock] = await Promise.all([
      listPerfumesByIds(supabaseAdmin, perfumeIds),
      // Stock (ml in the bottle): a volume is available only if there are enough ml left.
      readStockMap(supabaseAdmin, perfumeIds),
    ]);

    if (perfumesError) {
      console.error("ORDER PERFUMES FETCH ERROR:", perfumesError);
      return NextResponse.json(
        { error: "Greška pri proveri proizvoda." },
        { status: 500 }
      );
    }

    const perfumeMap = new Map<string, PerfumeRow>();

    for (const raw of perfumes ?? []) {
      const perfume = raw as {
        id: string;
        name: string;
        brand: string | null;
        is_active?: boolean | null;
        variants?: Array<{
          ml: number;
          price_rsd: number;
          in_stock: boolean;
        }> | null;
      };

      // A hidden perfume (admin "Hide from shop") can't be ordered, not even from an old cart.
      if (perfume.is_active === false) continue;

      perfumeMap.set(perfume.id, {
        id: perfume.id,
        // The order line keeps the full name ("Amouage Guidance"); that's how it shows in order history
        // and the admin.
        name: fullProductName(perfume),
        brand: perfume.brand ?? null,
        variants: (perfume.variants ?? []).map((variant) => ({
          ml: Number(variant.ml),
          price_rsd: Number(variant.price_rsd),
          in_stock: variantAvailable(Boolean(variant.in_stock), Number(variant.ml), stock.get(perfume.id)),
        })),
      });
    }

    const pricingPerfumes = [...perfumeMap.values()].map((perfume) => ({
      id: perfume.id,
      variants: perfume.variants.map((v) => ({ ml: v.ml, priceRsd: v.price_rsd, inStock: v.in_stock })),
    }));

    const resolvedItems: Array<{
      perfume_id: string;
      perfume_name: string;
      perfume_brand: string | null;
      ml: number;
      qty: number;
      price_rsd: number;
      line_total_rsd: number;
    }> = [];

    /** Bundle -> order lines (each perfume with its share of the price, so the admin knows what to pack). */
    const pushBundle = (perfumeIdsInBundle: string[], ml: number, discountPct: number, title: string, qty: number) => {
      const priced = priceBundle(perfumeIdsInBundle, pricingPerfumes, ml, discountPct);
      if (!priced.available) {
        const missing = priced.missing.map((id) => perfumeMap.get(id)?.name ?? id).join(", ");
        return `Paket „${title}” trenutno nije dostupan — nema ${ml} ml na stanju: ${missing}.`;
      }
      perfumeIdsInBundle.forEach((perfumeId, index) => {
        const perfume = perfumeMap.get(perfumeId)!;
        const priceRsd = priced.linePrices[index] ?? 0;
        resolvedItems.push({
          perfume_id: perfume.id,
          perfume_name: `${perfume.name} (paket „${title}”)`,
          perfume_brand: perfume.brand,
          ml,
          qty,
          price_rsd: priceRsd,
          line_total_rsd: priceRsd * qty,
        });
      });
      return null;
    };

    for (const item of items) {
      const bundleId = parseBundleCartId(item.id);
      if (bundleId) {
        const bundle = bundles.get(bundleId)!;
        const problem = pushBundle(bundle.perfume_ids, bundle.ml, bundle.discount_pct, bundle.title, item.qty);
        if (problem) return NextResponse.json({ error: problem }, { status: 400 });
        continue;
      }

      const customIds = parseCustomBundleCartId(item.id);
      if (customIds) {
        const problem = pushBundle(customIds, item.ml, customBundleDiscount(customIds.length), "Moj paket", item.qty);
        if (problem) return NextResponse.json({ error: problem }, { status: 400 });
        continue;
      }

      const perfume = perfumeMap.get(item.id);

      if (!perfume) {
        return NextResponse.json(
          { error: "Neki parfem iz korpe više nije u ponudi — ukloni ga iz korpe i pokušaj ponovo." },
          { status: 400 }
        );
      }

      const variant = perfume.variants.find(
        (v) => Number(v.ml) === Number(item.ml)
      );

      if (!variant) {
        return NextResponse.json(
          { error: `Varijanta ${item.ml} ml ne postoji za ${perfume.name}.` },
          { status: 400 }
        );
      }

      if (!variant.in_stock) {
        return NextResponse.json(
          { error: `${perfume.name} ${item.ml} ml trenutno nije na stanju.` },
          { status: 400 }
        );
      }

      const priceRsd = Number(variant.price_rsd);
      const lineTotalRsd = priceRsd * item.qty;

      resolvedItems.push({
        perfume_id: perfume.id,
        perfume_name: perfume.name,
        perfume_brand: perfume.brand,
        ml: item.ml,
        qty: item.qty,
        price_rsd: priceRsd,
        line_total_rsd: lineTotalRsd,
      });
    }

    const subtotalRsd = resolvedItems.reduce(
      (sum, item) => sum + item.line_total_rsd,
      0
    );

    // Coupon from the database (Admin > Coupons): validity, minimum amount, then an atomic "use" — two
    // concurrent orders can't both take the last use.
    let coupon: Coupon | null = null;

    if (couponCodeInput) {
      const code = normalizeCouponCode(couponCodeInput);
      const { data: couponRow, error: couponError } = await getCouponByCode(supabaseAdmin, code);

      if (couponError) {
        console.error("ORDER COUPON FETCH ERROR:", couponError);
        return NextResponse.json({ error: "Provera kupona nije uspela." }, { status: 500 });
      }

      const checked = checkCoupon(couponRow ?? null, subtotalRsd);
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 });
      }

      const { row: redeemed, error: redeemError } = await redeemCoupon(supabaseAdmin, code);
      if (redeemError) {
        console.error("ORDER COUPON REDEEM ERROR:", redeemError);
        return NextResponse.json({ error: "Provera kupona nije uspela." }, { status: 500 });
      }
      if (!redeemed) {
        return NextResponse.json(
          { error: "Kupon je upravo iskorišćen do kraja ili više ne važi. Ukloni ga i pošalji ponovo." },
          { status: 400 }
        );
      }

      coupon = checked.coupon;
    }

    /** Order wasn't written -> give the coupon use back. */
    const giveBackCoupon = async () => {
      if (!coupon) return;
      const { error } = await releaseCoupon(supabaseAdmin, coupon.code);
      if (error) console.error("ORDER COUPON RELEASE ERROR:", error);
    };

    const discountRsd = getCouponDiscount(subtotalRsd, coupon);
    // Free shipping above the threshold (goods total after discount), same rule as in the cart.
    const shopSettings = await readShopSettingsFresh(supabaseAdmin);
    const shippingRsd = shippingFor(resolvedItems.length, subtotalRsd - discountRsd, shopSettings);
    const totalRsd = Math.max(0, subtotalRsd - discountRsd + shippingRsd);

    // Stock: deduct ml for perfumes whose stock is tracked (all or nothing; two orders can't sell the same
    // last millilitre).
    const stockLines = resolvedItems
      .filter((item) => stock.has(item.perfume_id))
      .map((item) => ({ perfume_id: item.perfume_id, ml: item.ml * item.qty }));

    if (stockLines.length) {
      const consumed = await consumeStock(supabaseAdmin, stockLines);
      if (!consumed.ok) {
        await giveBackCoupon();
        if (consumed.shortPerfumeId) {
          const name = perfumeMap.get(consumed.shortPerfumeId)?.name ?? "Jedan parfem";
          return NextResponse.json(
            { error: `${name} — nema dovoljno na stanju za ovu količinu. Smanji količinu ili izaberi manju zapreminu.` },
            { status: 400 }
          );
        }
        console.error("ORDER STOCK CONSUME ERROR:", consumed.error);
        return NextResponse.json({ error: "Provera zaliha nije uspela." }, { status: 500 });
      }
    }

    /** Order wasn't written -> release the coupon and the stock. */
    const rollback = async () => {
      await giveBackCoupon();
      if (stockLines.length) {
        const { error } = await releaseStock(supabaseAdmin, stockLines);
        if (error) console.error("ORDER STOCK RELEASE ERROR:", error);
      }
    };

    const { data: order, error: orderError } = await insertOrder(supabaseAdmin, {
      user_id: user?.id ?? null,
      status: "pending",
      customer_full_name: fullName,
      customer_email: email,
      customer_phone: phone,
      customer_city: city,
      customer_address: address,
      customer_note: note || null,
      coupon_code: coupon?.code ?? null,
      subtotal_rsd: subtotalRsd,
      discount_rsd: discountRsd,
      shipping_rsd: shippingRsd,
      total_rsd: totalRsd,
      stock_state: stockLines.length ? "consumed" : "none",
    });

    if (orderError || !order) {
      console.error("ORDER INSERT ERROR:", orderError);
      await rollback();
      return NextResponse.json(
        { error: orderError?.message ?? "Greška pri kreiranju porudžbine." },
        { status: 500 }
      );
    }

    const itemRows = resolvedItems.map((item) => ({
      order_id: order.id,
      perfume_id: item.perfume_id,
      perfume_name: item.perfume_name,
      perfume_brand: item.perfume_brand ?? "",
      ml: item.ml,
      qty: item.qty,
      price_rsd: item.price_rsd,
      line_total_rsd: item.line_total_rsd,
    }));

    const { error: itemsError } = await insertOrderItems(
      supabaseAdmin,
      itemRows
    );

    if (itemsError) {
      console.error("ORDER ITEMS INSERT ERROR:", itemsError);

      await deleteOrderById(supabaseAdmin, order.id);
      await rollback();

      return NextResponse.json(
        { error: "Greška pri upisu stavki porudžbine." },
        { status: 500 }
      );
    }

    // Stock changed -> the shop shows "out of stock" right away where it ran out.
    if (stockLines.length) revalidateCatalog();

    // Emails (customer confirmation + admin notification) are sent AFTER the response, so the customer
    // doesn't wait.
    const ipsConfig = readIpsConfig();
    after(() =>
      sendNewOrderEmails({
        orderNumber: order.order_number,
        payment: ipsConfig
          ? {
              account: formatAccount(ipsConfig.account),
              payeeName: ipsConfig.payeeName,
              reference: referenceFromOrderNumber(order.order_number),
            }
          : null,
        customerName: fullName,
        customerEmail: email,
        phone,
        city,
        address,
        note: note || null,
        couponCode: coupon?.code ?? null,
        subtotalRsd,
        discountRsd,
        shippingRsd,
        totalRsd,
        items: resolvedItems.map((item) => ({
          name: item.perfume_name,
          ml: item.ml,
          qty: item.qty,
          lineTotalRsd: item.line_total_rsd,
        })),
      })
    );

    // IPS QR for instant payment (only when IPS_ACCOUNT_NUMBER and IPS_PAYEE_NAME are set)
    const payment = await buildIpsPayment(order.order_number, totalRsd);

    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
      payment,
      totals: {
        subtotalRsd,
        discountRsd,
        shippingRsd,
        totalRsd,
      },
    });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Greška pri slanju porudžbine." },
      { status: 500 }
    );
  }
}
