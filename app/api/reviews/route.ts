import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/db/clients/server";
import { getProductById } from "@/db/queries/perfumes";
import { getProfileFullName } from "@/db/queries/profiles";
import {
  deleteMyReview,
  getMyReceivedMl,
  revalidateProductReviews,
  upsertMyReview,
} from "@/db/queries/reviews";
import {
  mapReviewRow,
  normalizeMlList,
  parseReviewInput,
  resolveReviewMl,
  shortDisplayName,
} from "@/features/reviews/lib/reviews";
import { protectMutationRoute } from "@/lib/request-security";
import { cleanText } from "@/lib/validation";

const NOT_A_BUYER =
  "Recenziju može da ostavi kupac kome je stigla porudžbina sa ovim parfemom (porudžbina iz naloga, potvrđena kao preuzeta).";

async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

/**
 * New review or a change to the customer's own review (one per perfume).
 * The database (RLS) also refuses anyone who hasn't received the perfume; this check only gives a
 * clearer message.
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "reviews-save", limit: 10, windowMs: 60_000 });
  if (protection) return protection;

  try {
    const { supabase, user } = await getSignedInUser();
    if (!user) {
      return NextResponse.json({ error: "Prijavi se da bi ostavio/la recenziju." }, { status: 401 });
    }

    const parsed = parseReviewInput(await req.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.value;

    const product = await getProductById(input.productId);
    if (!product) {
      return NextResponse.json({ error: "Parfem nije pronađen." }, { status: 404 });
    }

    const [received, profile] = await Promise.all([
      getMyReceivedMl(supabase, input.productId),
      getProfileFullName(supabase, user.id),
    ]);

    if (received.error) {
      console.error("REVIEW RECEIVED CHECK ERROR:", received.error);
      return NextResponse.json({ error: "Recenzija nije sačuvana." }, { status: 500 });
    }

    const receivedMl = normalizeMlList(received.data);
    if (!receivedMl.length) {
      return NextResponse.json({ error: NOT_A_BUYER }, { status: 403 });
    }

    const ml = resolveReviewMl(input.ml, receivedMl);
    if (!ml.ok) {
      return NextResponse.json({ error: "Izaberi zapreminu koju si kupio/la." }, { status: 400 });
    }

    const profileName = (profile.data as { full_name: string | null } | null)?.full_name;
    const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

    const { data, error } = await upsertMyReview(supabase, {
      product_id: input.productId,
      user_id: user.id,
      rating: input.rating,
      comment: input.comment,
      ml: ml.ml,
      full_name:
        shortDisplayName(profileName) ?? shortDisplayName(typeof metadataName === "string" ? metadataName : null),
    });

    if (error || !data) {
      console.error("REVIEW SAVE ERROR:", error);
      // 42501 = RLS refused the row (not a verified buyer).
      const refused = error?.code === "42501";
      return NextResponse.json(
        { error: refused ? NOT_A_BUYER : "Recenzija nije sačuvana. Pokušaj ponovo." },
        { status: refused ? 403 : 500 }
      );
    }

    revalidateProductReviews(input.productId);

    return NextResponse.json({ review: mapReviewRow(data) });
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json({ error: "Recenzija nije sačuvana. Pokušaj ponovo." }, { status: 500 });
  }
}

/** Deletes the customer's own review of a perfume (?productId=). */
export async function DELETE(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "reviews-delete", limit: 10, windowMs: 60_000 });
  if (protection) return protection;

  const productId = cleanText(req.nextUrl.searchParams.get("productId"));
  if (!productId || productId.length > 200) {
    return NextResponse.json({ error: "Nedostaje parfem." }, { status: 400 });
  }

  try {
    const { supabase, user } = await getSignedInUser();
    if (!user) {
      return NextResponse.json({ error: "Moraš biti prijavljen." }, { status: 401 });
    }

    const { data, error } = await deleteMyReview(supabase, user.id, productId);
    if (error) {
      console.error("REVIEW DELETE ERROR:", error);
      return NextResponse.json({ error: "Brisanje nije uspelo." }, { status: 500 });
    }

    if (!data?.length) {
      return NextResponse.json({ error: "Recenzija nije pronađena." }, { status: 404 });
    }

    revalidateProductReviews(productId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/reviews error:", error);
    return NextResponse.json({ error: "Brisanje nije uspelo." }, { status: 500 });
  }
}
