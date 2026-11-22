/**
 * Tabela: user_addresses
 */
import type { Db } from "@/db/types";

export type AddressWriteFields = {
  full_name: string;
  phone: string;
  city: string;
  postal_code: string;
  street: string;
  apartment: string | null;
  note: string | null;
  is_default: boolean;
};

/**
 * All addresses, default first.
 * If `userId` isn't passed, RLS does the filtering (users only see their own).
 */
export async function listAddresses(db: Db, userId?: string) {
  let request = db.from("user_addresses").select("*");

  if (userId) {
    request = request.eq("user_id", userId);
  }

  return await request
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function countAddresses(db: Db, userId: string) {
  return await db
    .from("user_addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
}

export async function getAddressById(db: Db, id: string, userId: string) {
  return await db
    .from("user_addresses")
    .select("id, is_default")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
}

/** All of a user's addresses (id, is_default, created_at), oldest first. */
export async function listAddressSummaries(db: Db, userId: string) {
  return await db
    .from("user_addresses")
    .select("id, is_default, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
}

export async function insertAddress(
  db: Db,
  userId: string,
  fields: AddressWriteFields
) {
  return await db.from("user_addresses").insert({ user_id: userId, ...fields });
}

export async function updateAddress(
  db: Db,
  id: string,
  userId: string,
  fields: AddressWriteFields
) {
  return await db
    .from("user_addresses")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId);
}

/** Skida oznaku "podrazumevana" sa svih adresa korisnika. */
export async function clearDefaultAddresses(db: Db, userId: string) {
  return await db
    .from("user_addresses")
    .update({ is_default: false })
    .eq("user_id", userId);
}

export async function setAddressDefault(db: Db, id: string, userId: string) {
  return await db
    .from("user_addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteAddress(db: Db, id: string, userId: string) {
  return await db
    .from("user_addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}
