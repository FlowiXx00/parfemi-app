import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/db/clients/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { getProfileFullName } from "@/db/queries/profiles";
import { getAdminAccess } from "@/db/queries/roles";

/**
 * Who is viewing the admin (once per request; layout and page share the result).
 * Not signed in -> /login, no admin/demo role -> home page.
 */
export const getAdminContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login?next=/admin");

  const { access, error: roleError } = await getAdminAccess(supabaseAdmin, user.id);
  if (roleError || !access) redirect("/");

  const [{ data: profileData }, { count: pendingCount }] = await Promise.all([
    getProfileFullName(supabaseAdmin, user.id),
    // Number of new orders for the sidebar badge.
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const fullName = ((profileData as { full_name: string | null } | null)?.full_name ?? "").trim();

  return {
    displayName: fullName || user.email || "admin",
    pendingCount: pendingCount ?? 0,
    isDemo: access === "demo",
  };
});
