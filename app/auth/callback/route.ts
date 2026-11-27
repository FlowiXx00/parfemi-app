import { NextResponse } from "next/server";
import { createClient } from "@/db/clients/server";
import { hasSupabasePublicEnv } from "@/db/clients/env";
import { sanitizeNextPath } from "@/lib/safe-next";
import { claimGuestOrdersFor } from "@/features/account/server/claim-guest-orders";

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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("exchangeCodeForSession ERROR:", error);
    return NextResponse.redirect(
      `${url.origin}/login?error=oauth_callback_failed`
    );
  }

  // Google sign-in or a confirmed sign-up: earlier guest orders with this email join the account.
  await claimGuestOrdersFor(data.user ?? null);

  return NextResponse.redirect(`${url.origin}${nextPath}`);
}
