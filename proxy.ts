import { type NextRequest } from "next/server";
import { updateSession } from "@/db/clients/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Supabase session refresh only runs where the server reads the signed-in user.
 * Public pages (/, /shop, /shop/[id], info pages) DON'T go through the proxy:
 * they stay static and visits don't call Supabase Auth.
 * In the browser the Supabase client refreshes the token itself.
 *
 * When adding a page/route that reads the user on the server, add it here.
 */
export const config = {
  matcher: [
    "/settings/:path*",
    "/addresses/:path*",
    "/orders/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/api/account/:path*",
    "/api/orders/:path*",
    "/api/admin/:path*",
  ],
};
