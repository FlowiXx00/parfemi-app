/**
 * Tabele: user_roles (+ join na roles)
 */
import type { Db } from "@/db/types";

type RoleJoin = { name: string };
type RoleRow = { roles: RoleJoin | RoleJoin[] | null };

/** Names of all active (non-revoked) roles of a user, without duplicates. */
async function getUserRoleNames(db: Db, userId: string) {
  const { data, error } = await db
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  const names =
    (data as unknown as RoleRow[] | null)?.flatMap((row) => {
      const r = row.roles;
      if (!r) return [];
      return Array.isArray(r) ? r.map((x) => x.name) : [r.name];
    }) ?? [];

  return { names: Array.from(new Set(names)), error };
}

/** Admin access: "admin" (everything), "demo" (read-only, no changes, masked customers) or null. */
export type AdminAccess = "admin" | "demo" | null;

export async function getAdminAccess(db: Db, userId: string): Promise<{ access: AdminAccess; error: unknown }> {
  const { names, error } = await getUserRoleNames(db, userId);
  const access: AdminAccess = names.includes("admin") ? "admin" : names.includes("demo") ? "demo" : null;
  return { access, error };
}
