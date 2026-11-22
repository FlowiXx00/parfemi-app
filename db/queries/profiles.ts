/**
 * Tabela: profiles
 */
import type { Db } from "@/db/types";

export async function getProfileById(db: Db, userId: string) {
  return await db
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
}

export async function getProfileFullName(db: Db, userId: string) {
  return await db
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
}

/** Updates the profile, or creates it if the row doesn't exist. Throws if the query fails. */
export async function saveProfile(
  db: Db,
  payload: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
  }
) {
  const updatePayload = {
    email: payload.email,
    full_name: payload.full_name,
    avatar_url: payload.avatar_url,
  };

  const { data: updatedRow, error: updateError } = await db
    .from("profiles")
    .update(updatePayload)
    .eq("id", payload.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (updatedRow?.id) {
    return updatedRow;
  }

  const { data: insertedRow, error: insertError } = await db
    .from("profiles")
    .insert({
      id: payload.id,
      ...updatePayload,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedRow;
}
