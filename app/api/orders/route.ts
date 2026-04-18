import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { createClient } from "@/shared/supabase/supabase-server";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import {
  findCoupon,
  getCouponDiscount,
  normalizeCouponCode,
} from "@/features/orders/lib/coupons";

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

const SHIPPING_RSD = 580;
const MAX_DISTINCT_ITEMS = 30;
const MAX_ITEM_QTY = 20;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
  image_url: string | null;
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

    const perfumeIds = Array.from(new Set(items.map((item) => item.id)));

    const { data: perfumes, error: perfumesError } = await supabaseAdmin
      .from("perfumes")
      .select(`
        id,
        name,
        brand,
        image_url,
        variants:perfume_variants (
          ml,
          price_rsd,
          in_stock
        )
      `)
      .in("id", perfumeIds);

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
        image_url: string | null;
        variants?: Array<{
          ml: number;
          price_rsd: number;
          in_stock: boolean;
        }> | null;
      };

      perfumeMap.set(perfume.id, {
        id: perfume.id,
        name: perfume.name,
        brand: perfume.brand ?? null,
        image_url: perfume.image_url ?? null,
        variants: (perfume.variants ?? []).map((variant) => ({
          ml: Number(variant.ml),
          price_rsd: Number(variant.price_rsd),
          in_stock: Boolean(variant.in_stock),
        })),
      });
    }

    const resolvedItems: Array<{
      perfume_id: string;
      perfume_name: string;
      perfume_brand: string | null;
      image_url: string | null;
      ml: number;
      qty: number;
      price_rsd: number;
      line_total_rsd: number;
    }> = [];

    for (const item of items) {
      const perfume = perfumeMap.get(item.id);

      if (!perfume) {
        return NextResponse.json(
          { error: "Proizvod nije pronađen." },
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
        image_url: perfume.image_url,
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

    const coupon = couponCodeInput
      ? findCoupon(normalizeCouponCode(couponCodeInput))
      : null;

    if (couponCodeInput && !coupon) {
      return NextResponse.json(
        { error: "Kupon nije pronađen." },
        { status: 400 }
      );
    }

    if (coupon?.minSubtotal && subtotalRsd < coupon.minSubtotal) {
      return NextResponse.json(
        {
          error: `Za kupon ${coupon.code} potrebno je najmanje ${coupon.minSubtotal} rsd u korpi.`,
        },
        { status: 400 }
      );
    }

    const discountRsd = getCouponDiscount(subtotalRsd, coupon);
    const shippingRsd = resolvedItems.length > 0 ? SHIPPING_RSD : 0;
    const totalRsd = Math.max(0, subtotalRsd - discountRsd + shippingRsd);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
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
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("ORDER INSERT ERROR:", orderError);
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
      image_url: item.image_url,
      ml: item.ml,
      qty: item.qty,
      price_rsd: item.price_rsd,
      line_total_rsd: item.line_total_rsd,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(itemRows);

    if (itemsError) {
      console.error("ORDER ITEMS INSERT ERROR:", itemsError);

      await supabaseAdmin.from("orders").delete().eq("id", order.id);

      return NextResponse.json(
        { error: "Greška pri upisu stavki porudžbine." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
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