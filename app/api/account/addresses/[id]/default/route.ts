import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import {
  clearDefaultAddresses,
  getAddressById,
  setAddressDefault,
} from "@/db/queries/addresses";
import {
  getAuthedContext,
  listAddressesResponse,
  type RouteContext,
} from "@/features/account/server/addresses-route";

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

    const { data: existingAddress, error: existingError } =
      await getAddressById(ctx.supabase, addressId, ctx.userId);

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

    const { error: resetDefaultsError } = await clearDefaultAddresses(
      ctx.supabase,
      ctx.userId
    );

    if (resetDefaultsError) {
      console.error("RESET DEFAULT ADDRESSES ERROR:", resetDefaultsError);

      return NextResponse.json(
        { error: "Greška pri postavljanju podrazumevane adrese." },
        { status: 500 }
      );
    }

    const { error: setDefaultError } = await setAddressDefault(
      ctx.supabase,
      addressId,
      ctx.userId
    );

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