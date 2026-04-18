export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { createClient } from "@/shared/supabase/supabase-server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type NormalizedAddressPayload = {
  full_name: string;
  phone: string;
  city: string;
  postal_code: string;
  street: string;
  apartment: string | null;
  note: string | null;
  is_default: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAddressPayload(body: unknown): NormalizedAddressPayload {
  const row =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const apartment = cleanText(row.apartment);
  const note = cleanText(row.note);

  return {
    full_name: cleanText(row.fullName),
    phone: cleanText(row.phone),
    city: cleanText(row.city),
    postal_code: cleanText(row.postalCode),
    street: cleanText(row.street),
    apartment: apartment || null,
    note: note || null,
    is_default: Boolean(row.isDefault),
  };
}

function validateAddressPayload(payload: NormalizedAddressPayload) {
  if (!payload.full_name) return "Ime i prezime je obavezno.";
  if (!payload.phone) return "Telefon je obavezan.";
  if (!payload.city) return "Grad je obavezan.";
  if (!payload.postal_code) return "Poštanski broj je obavezan.";
  if (!payload.street) return "Ulica i broj su obavezni.";

  return null;
}

async function getAuthedContext(): Promise<
  | {
      supabase: ServerSupabase;
      userId: string;
      errorResponse: null;
    }
  | {
      supabase: null;
      userId: null;
      errorResponse: NextResponse;
    }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase: null,
      userId: null,
      errorResponse: NextResponse.json(
        { error: "Moraš biti prijavljen." },
        { status: 401 }
      ),
    };
  }

  return {
    supabase,
    userId: user.id,
    errorResponse: null,
  };
}

async function listAddressesResponse(
  supabase: ServerSupabase,
  userId: string
) {
  const { data, error } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LIST USER ADDRESSES ERROR:", error);

    return NextResponse.json(
      { error: "Greška pri učitavanju adresa." },
      { status: 500 }
    );
  }

  return NextResponse.json({ addresses: data ?? [] });
}

export async function GET() {
  try {
    const ctx = await getAuthedContext();

    if (ctx.errorResponse) {
      return ctx.errorResponse;
    }

    return listAddressesResponse(ctx.supabase, ctx.userId);
  } catch (error) {
    console.error("GET /api/account/addresses error:", error);

    return NextResponse.json(
      { error: "Greška pri učitavanju adresa." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "account-addresses-create",
    limit: 15,
    windowMs: 60_000,
  });

  if (protection) {
    return protection;
  }

  try {
    const ctx = await getAuthedContext();

    if (ctx.errorResponse) {
      return ctx.errorResponse;
    }

    const body = await req.json();
    const payload = normalizeAddressPayload(body);
    const validationError = validateAddressPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { count, error: countError } = await ctx.supabase
      .from("user_addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId);

    if (countError) {
      console.error("COUNT USER ADDRESSES ERROR:", countError);

      return NextResponse.json(
        { error: "Greška pri dodavanju adrese." },
        { status: 500 }
      );
    }

    const shouldBeDefault = Boolean(payload.is_default) || (count ?? 0) === 0;

    if (shouldBeDefault) {
      const { error: resetDefaultsError } = await ctx.supabase
        .from("user_addresses")
        .update({ is_default: false })
        .eq("user_id", ctx.userId);

      if (resetDefaultsError) {
        console.error("RESET DEFAULT ADDRESSES ERROR:", resetDefaultsError);

        return NextResponse.json(
          { error: "Greška pri dodavanju adrese." },
          { status: 500 }
        );
      }
    }

    const { error: insertError } = await ctx.supabase
      .from("user_addresses")
      .insert({
        user_id: ctx.userId,
        ...payload,
        is_default: shouldBeDefault,
      });

    if (insertError) {
      console.error("INSERT USER ADDRESS ERROR:", insertError);

      return NextResponse.json(
        { error: "Greška pri dodavanju adrese." },
        { status: 500 }
      );
    }

    return listAddressesResponse(ctx.supabase, ctx.userId);
  } catch (error) {
    console.error("POST /api/account/addresses error:", error);

    return NextResponse.json(
      { error: "Greška pri dodavanju adrese." },
      { status: 500 }
    );
  }
}