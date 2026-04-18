import { NextResponse } from "next/server";
import { createClient } from "@/shared/supabase/supabase-server";
import { hasSupabasePublicEnv } from "@/shared/supabase/env";
import { sanitizeNextPath } from "@/shared/lib/safe-next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      `${url.origin}/login?error=oauth_callback_failed`
    );
  }

  if (!hasSupabasePublicEnv()) {
    return NextResponse.redirect(`${url.origin}/login?error=supabase_not_configured`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession ERROR:", error);
    return NextResponse.redirect(
      `${url.origin}/login?error=oauth_callback_failed`
    );
  }

  return NextResponse.redirect(`${url.origin}${nextPath}`);
}
