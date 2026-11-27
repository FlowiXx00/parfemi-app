import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/db/clients/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { countShippedOrdersWithPerfume } from "@/db/queries/orders";
import { getProfileFullName } from "@/db/queries/profiles";
import { getMyReceivedMl, getMyReview } from "@/db/queries/reviews";
import { claimGuestOrdersFor } from "@/features/account/server/claim-guest-orders";
import {
  ANONYMOUS_REVIEWER,
  mapReviewRow,
  normalizeMlList,
  shortDisplayName,
  type MyReviewState,
} from "@/features/reviews/lib/reviews";
import { protectLookupRoute } from "@/lib/request-security";
import { cleanText } from "@/lib/validation";

/**
 * The signed-in customer and one perfume: their review (if any) and whether they may write one
 * (received an order with this perfume). The product page asks this only when its reviews section
 * scrolls into view.
 */
export async function GET(req: NextRequest) {
  const limited = protectLookupRoute(req, { key: "reviews-mine", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const productId = cleanText(req.nextUrl.searchParams.get("productId"));
  if (!productId || productId.length > 200) {
    return NextResponse.json({ error: "Nedostaje parfem." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Moraš biti prijavljen." }, { status: 401 });
    }

    // A guest purchase with the same (confirmed) email counts too: it joins the account first.
    await claimGuestOrdersFor(user);

    const [mine, received, profile] = await Promise.all([
      getMyReview(supabase, user.id, productId),
      getMyReceivedMl(supabase, productId),
      getProfileFullName(supabase, user.id),
    ]);

    if (mine.error || received.error) {
      console.error("REVIEWS MINE ERROR:", mine.error ?? received.error);
      return NextResponse.json({ error: "Recenzija nije učitana." }, { status: 500 });
    }

    const receivedMl = normalizeMlList(received.data);

    // Not received yet: is it on its way? (Then the customer only has to confirm receipt.)
    let pendingReceipt = false;
    if (!receivedMl.length) {
      const shipped = await countShippedOrdersWithPerfume(supabaseAdmin, user.id, productId);
      if (shipped.error) console.error("REVIEWS SHIPPED CHECK ERROR:", shipped.error);
      pendingReceipt = (shipped.count ?? 0) > 0;
    }

    const profileName = (profile.data as { full_name: string | null } | null)?.full_name;
    const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const state: MyReviewState = {
      review: mine.data ? mapReviewRow(mine.data) : null,
      receivedMl,
      pendingReceipt,
      displayName:
        shortDisplayName(profileName) ??
        shortDisplayName(typeof metadataName === "string" ? metadataName : null) ??
        ANONYMOUS_REVIEWER,
    };

    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/reviews/mine error:", error);
    return NextResponse.json({ error: "Recenzija nije učitana." }, { status: 500 });
  }
}
