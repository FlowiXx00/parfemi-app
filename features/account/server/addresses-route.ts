import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/db/clients/server";
import { listAddresses, type AddressWriteFields } from "@/db/queries/addresses";
import { cleanText } from "@/lib/validation";

/**
 * Shared code for the /api/account/addresses routes:
 * auth check, payload cleanup/validation and a response with the address list.
 */

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export function normalizeAddressPayload(body: unknown): AddressWriteFields {
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

export function validateAddressPayload(payload: AddressWriteFields) {
  if (!payload.full_name) return "Ime i prezime je obavezno.";
  if (!payload.phone) return "Telefon je obavezan.";
  if (!payload.city) return "Grad je obavezan.";
  if (!payload.postal_code) return "Poštanski broj je obavezan.";
  if (!payload.street) return "Ulica i broj su obavezni.";

  return null;
}

export async function getAuthedContext(): Promise<
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

export async function listAddressesResponse(
  supabase: ServerSupabase,
  userId: string
) {
  const { data, error } = await listAddresses(supabase, userId);

  if (error) {
    console.error("LIST USER ADDRESSES ERROR:", error);

    return NextResponse.json(
      { error: "Greška pri učitavanju adresa." },
      { status: 500 }
    );
  }

  return NextResponse.json({ addresses: data ?? [] });
}
