import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/db/clients/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { getAdminAccess } from "@/db/queries/roles";

type RequireAdminResult =
  | { ok: true; userId: string; isDemo: boolean }
  | { ok: false; response: NextResponse };

const DEMO_READ_ONLY_MESSAGE = "Demo nalog — izmene su isključene. Ovo je samo pregled admin panela.";

/**
 * Admin access check for API routes.
 * allowDemo: true only for routes that READ data (lists); the demo account can never change data.
 */
export async function requireAdminFromCookies(options: { allowDemo?: boolean } = {}): Promise<RequireAdminResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Niste autorizovani." }, { status: 401 }),
    };
  }

  const { access, error } = await getAdminAccess(supabaseAdmin, user.id);

  if (error) {
    console.error("ROLE CHECK ERROR:", error);
    return {
      ok: false,
      response: NextResponse.json({ error: "Greška pri proveri role." }, { status: 500 }),
    };
  }

  // 423 (Locked), not 403: admin pages redirect home on 403, while the demo user should just see the
  // message.
  if (access === "demo" && !options.allowDemo) {
    return {
      ok: false,
      response: NextResponse.json({ error: DEMO_READ_ONLY_MESSAGE, demo: true }, { status: 423 }),
    };
  }

  if (access !== "admin" && access !== "demo") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nemate admin pristup." }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, isDemo: access === "demo" };
}
