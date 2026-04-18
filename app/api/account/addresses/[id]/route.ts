import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { createClient } from "@/shared/supabase/supabase-server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function PATCH(req: NextRequest, context: RouteContext) {
  const protection = protectMutationRoute(req, {
    key: "account-addresses-update",
    limit: 20,
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

    const { id } = await context.params;
    const addressId = typeof id === "string" ? id.trim() : "";

    if (!addressId) {
      return NextResponse.json(
        { error: "Neispravan id adrese." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const payload = normalizeAddressPayload(body);
    const validationError = validateAddressPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: existingAddress, error: existingError } = await ctx.supabase
      .from("user_addresses")
      .select("id, is_default")
      .eq("id", addressId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existingError) {
      console.error("GET ADDRESS FOR UPDATE ERROR:", existingError);

      return NextResponse.json(
        { error: "Greška pri izmeni adrese." },
        { status: 500 }
      );
    }

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Adresa nije pronađena." },
        { status: 404 }
      );
    }

    const { data: allAddresses, error: addressesError } = await ctx.supabase
      .from("user_addresses")
      .select("id, is_default, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true });

    if (addressesError) {
      console.error("GET ALL ADDRESSES FOR UPDATE ERROR:", addressesError);

      return NextResponse.json(
        { error: "Greška pri izmeni adrese." },
        { status: 500 }
      );
    }

    const addresses = allAddresses ?? [];
    const shouldBeDefault =
      addresses.length === 1 ? true : Boolean(payload.is_default);

    if (shouldBeDefault) {
      const { error: resetDefaultsError } = await ctx.supabase
        .from("user_addresses")
        .update({ is_default: false })
        .eq("user_id", ctx.userId);

      if (resetDefaultsError) {
        console.error("RESET DEFAULT ADDRESSES ERROR:", resetDefaultsError);

        return NextResponse.json(
          { error: "Greška pri izmeni adrese." },
          { status: 500 }
        );
      }
    }

    const { error: updateError } = await ctx.supabase
      .from("user_addresses")
      .update({
        ...payload,
        is_default: shouldBeDefault,
      })
      .eq("id", addressId)
      .eq("user_id", ctx.userId);

    if (updateError) {
      console.error("UPDATE USER ADDRESS ERROR:", updateError);

      return NextResponse.json(
        { error: "Greška pri izmeni adrese." },
        { status: 500 }
      );
    }

    const fallbackAddressId =
      addresses.find((address) => address.id !== addressId)?.id ?? null;

    if (
      !shouldBeDefault &&
      existingAddress.is_default &&
      fallbackAddressId
    ) {
      const { error: fallbackError } = await ctx.supabase
        .from("user_addresses")
        .update({ is_default: true })
        .eq("id", fallbackAddressId)
        .eq("user_id", ctx.userId);

      if (fallbackError) {
        console.error("SET FALLBACK DEFAULT ADDRESS ERROR:", fallbackError);

        return NextResponse.json(
          { error: "Greška pri izmeni adrese." },
          { status: 500 }
        );
      }
    }

    return listAddressesResponse(ctx.supabase, ctx.userId);
  } catch (error) {
    console.error("PATCH /api/account/addresses/[id] error:", error);

    return NextResponse.json(
      { error: "Greška pri izmeni adrese." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const protection = protectMutationRoute(req, {
    key: "account-addresses-delete",
    limit: 20,
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

    const { id } = await context.params;
    const addressId = typeof id === "string" ? id.trim() : "";

    if (!addressId) {
      return NextResponse.json(
        { error: "Neispravan id adrese." },
        { status: 400 }
      );
    }

    const { data: existingAddress, error: existingError } = await ctx.supabase
      .from("user_addresses")
      .select("id, is_default")
      .eq("id", addressId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existingError) {
      console.error("GET ADDRESS FOR DELETE ERROR:", existingError);

      return NextResponse.json(
        { error: "Greška pri brisanju adrese." },
        { status: 500 }
      );
    }

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Adresa nije pronađena." },
        { status: 404 }
      );
    }

    const { data: allAddresses, error: addressesError } = await ctx.supabase
      .from("user_addresses")
      .select("id, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true });

    if (addressesError) {
      console.error("GET ALL ADDRESSES FOR DELETE ERROR:", addressesError);

      return NextResponse.json(
        { error: "Greška pri brisanju adrese." },
        { status: 500 }
      );
    }

    const fallbackAddressId =
      (allAddresses ?? []).find((address) => address.id !== addressId)?.id ?? null;

    const { error: deleteError } = await ctx.supabase
      .from("user_addresses")
      .delete()
      .eq("id", addressId)
      .eq("user_id", ctx.userId);

    if (deleteError) {
      console.error("DELETE USER ADDRESS ERROR:", deleteError);

      return NextResponse.json(
        { error: "Greška pri brisanju adrese." },
        { status: 500 }
      );
    }

    if (existingAddress.is_default && fallbackAddressId) {
      const { error: fallbackError } = await ctx.supabase
        .from("user_addresses")
        .update({ is_default: true })
        .eq("id", fallbackAddressId)
        .eq("user_id", ctx.userId);

      if (fallbackError) {
        console.error("SET FALLBACK DEFAULT ADDRESS ERROR:", fallbackError);

        return NextResponse.json(
          { error: "Greška pri brisanju adrese." },
          { status: 500 }
        );
      }
    }

    return listAddressesResponse(ctx.supabase, ctx.userId);
  } catch (error) {
    console.error("DELETE /api/account/addresses/[id] error:", error);

    return NextResponse.json(
      { error: "Greška pri brisanju adrese." },
      { status: 500 }
    );
  }
}