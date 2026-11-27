import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/db/clients/proxy";
import { classifyCatalogRequest } from "@/lib/bot-guard";

export async function proxy(request: NextRequest) {
  // The catalog JSON is for our own pages in a browser; it needs no session. The proxy runs before the
  // CDN cache, so the check holds even though the catalog itself is cached.
  if (request.nextUrl.pathname.startsWith("/api/catalog")) {
    if (classifyCatalogRequest(request.headers) !== "browser") {
      return NextResponse.json(
        { error: "Pristup nije dozvoljen." },
        { status: 403, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
      );
    }
    return NextResponse.next();
  }

  return await updateSession(request);
}

/**
 * Supabase session refresh only runs where the server reads the signed-in user.
 * Public pages (/, /shop, /shop/[id], info pages) DON'T go through the proxy:
 * they stay static and visits don't call Supabase Auth.
 * In the browser the Supabase client refreshes the token itself.
 * /api/catalog goes through it only for the bot check above (no Supabase call).
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
    "/api/reviews/:path*",
    "/api/admin/:path*",
    "/api/catalog/:path*",
  ],
};
