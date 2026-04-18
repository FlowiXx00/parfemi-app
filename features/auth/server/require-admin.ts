import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/shared/supabase/supabase-server";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";

type RoleJoin = { name: string };
type RoleRow = { roles: RoleJoin | RoleJoin[] | null };

type RequireAdminResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireAdminFromCookies(): Promise<RequireAdminResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Niste autorizovani." },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) {
    console.error("ROLE CHECK ERROR:", error);

    return {
      ok: false,
      response: NextResponse.json(
        { error: "Greška pri proveri role." },
        { status: 500 }
      ),
    };
  }

  const roleNames =
    (data as RoleRow[] | null)
      ?.flatMap((row) => {
        const r = row.roles;
        if (!r) return [];
        return Array.isArray(r) ? r.map((x) => x.name) : [r.name];
      }) ?? [];

  const isAdmin = Array.from(new Set(roleNames)).includes("admin");

  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nemate admin pristup." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
  };
}