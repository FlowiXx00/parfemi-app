import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import {
  clearDefaultAddresses,
  deleteAddress,
  getAddressById,
  listAddressSummaries,
  setAddressDefault,
  updateAddress,
} from "@/db/queries/addresses";
import {
  getAuthedContext,
  listAddressesResponse,
  normalizeAddressPayload,
  validateAddressPayload,
  type RouteContext,
} from "@/features/account/server/addresses-route";

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

    const { data: existingAddress, error: existingError } =
      await getAddressById(ctx.supabase, addressId, ctx.userId);

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

    const { data: allAddresses, error: addressesError } =
      await listAddressSummaries(ctx.supabase, ctx.userId);

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
      const { error: resetDefaultsError } = await clearDefaultAddresses(
        ctx.supabase,
        ctx.userId
      );

      if (resetDefaultsError) {
        console.error("RESET DEFAULT ADDRESSES ERROR:", resetDefaultsError);

        return NextResponse.json(
          { error: "Greška pri izmeni adrese." },
          { status: 500 }
        );
      }
    }

    const { error: updateError } = await updateAddress(
      ctx.supabase,
      addressId,
      ctx.userId,
      { ...payload, is_default: shouldBeDefault }
    );

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
      const { error: fallbackError } = await setAddressDefault(
        ctx.supabase,
        fallbackAddressId,
        ctx.userId
      );

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

    const { data: existingAddress, error: existingError } =
      await getAddressById(ctx.supabase, addressId, ctx.userId);

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

    const { data: allAddresses, error: addressesError } =
      await listAddressSummaries(ctx.supabase, ctx.userId);

    if (addressesError) {
      console.error("GET ALL ADDRESSES FOR DELETE ERROR:", addressesError);

      return NextResponse.json(
        { error: "Greška pri brisanju adrese." },
        { status: 500 }
      );
    }

    const fallbackAddressId =
      (allAddresses ?? []).find((address) => address.id !== addressId)?.id ?? null;

    const { error: deleteError } = await deleteAddress(
      ctx.supabase,
      addressId,
      ctx.userId
    );

    if (deleteError) {
      console.error("DELETE USER ADDRESS ERROR:", deleteError);

      return NextResponse.json(
        { error: "Greška pri brisanju adrese." },
        { status: 500 }
      );
    }

    if (existingAddress.is_default && fallbackAddressId) {
      const { error: fallbackError } = await setAddressDefault(
        ctx.supabase,
        fallbackAddressId,
        ctx.userId
      );

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