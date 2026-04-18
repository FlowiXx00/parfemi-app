import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { createClient } from "@/shared/supabase/supabase-server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function POST(req: NextRequest, context: RouteContext) {
  const protection = protectMutationRoute(req, {
    key: "account-addresses-default",
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
      .select("id")
      .eq("id", addressId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (existingError) {
      console.error("GET ADDRESS FOR DEFAULT ERROR:", existingError);

      return NextResponse.json(
        { error: "Greška pri postavljanju podrazumevane adrese." },
        { status: 500 }
      );
    }

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Adresa nije pronađena." },
        { status: 404 }
      );
    }

    const { error: resetDefaultsError } = await ctx.supabase
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", ctx.userId);

    if (resetDefaultsError) {
      console.error("RESET DEFAULT ADDRESSES ERROR:", resetDefaultsError);

      return NextResponse.json(
        { error: "Greška pri postavljanju podrazumevane adrese." },
        { status: 500 }
      );
    }

    const { error: setDefaultError } = await ctx.supabase
      .from("user_addresses")
      .update({ is_default: true })
      .eq("id", addressId)
      .eq("user_id", ctx.userId);

    if (setDefaultError) {
      console.error("SET DEFAULT ADDRESS ERROR:", setDefaultError);

      return NextResponse.json(
        { error: "Greška pri postavljanju podrazumevane adrese." },
        { status: 500 }
      );
    }

    return listAddressesResponse(ctx.supabase, ctx.userId);
  } catch (error) {
    console.error("POST /api/account/addresses/[id]/default error:", error);

    return NextResponse.json(
      { error: "Greška pri postavljanju podrazumevane adrese." },
      { status: 500 }
    );
  }
}