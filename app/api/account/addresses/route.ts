export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import {
  clearDefaultAddresses,
  countAddresses,
  insertAddress,
} from "@/db/queries/addresses";
import {
  getAuthedContext,
  listAddressesResponse,
  normalizeAddressPayload,
  validateAddressPayload,
} from "@/features/account/server/addresses-route";

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

    const { count, error: countError } = await countAddresses(
      ctx.supabase,
      ctx.userId
    );

    if (countError) {
      console.error("COUNT USER ADDRESSES ERROR:", countError);

      return NextResponse.json(
        { error: "Greška pri dodavanju adrese." },
        { status: 500 }
      );
    }

    const shouldBeDefault = Boolean(payload.is_default) || (count ?? 0) === 0;

    if (shouldBeDefault) {
      const { error: resetDefaultsError } = await clearDefaultAddresses(
        ctx.supabase,
        ctx.userId
      );

      if (resetDefaultsError) {
        console.error("RESET DEFAULT ADDRESSES ERROR:", resetDefaultsError);

        return NextResponse.json(
          { error: "Greška pri dodavanju adrese." },
          { status: 500 }
        );
      }
    }

    const { error: insertError } = await insertAddress(ctx.supabase, ctx.userId, {
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