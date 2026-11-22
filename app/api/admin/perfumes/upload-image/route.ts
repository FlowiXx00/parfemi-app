import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { ImportError } from "@/features/admin/perfumes/server/safe-fetch";
import { MAX_IMAGE_BYTES, storeImageBytes } from "@/features/admin/perfumes/server/mirror-images";
import { protectMutationRoute } from "@/lib/request-security";

/** Image upload from the admin's computer -> Supabase Storage. Returns the public URL for the image field. */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-perfumes-upload-image",
    limit: 30,
    windowMs: 60_000,
  });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Izaberi sliku." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Slika je prevelika (najviše 10 MB)." }, { status: 400 });
  }

  // A new perfume has no ID yet -> images go to a temporary folder (they still work normally).
  const perfumeId = String(form.get("perfumeId") ?? "").trim() || "novi";

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await storeImageBytes(perfumeId, bytes, file.type);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[upload-image]", error);
    return NextResponse.json({ error: "Slanje slike nije uspelo." }, { status: 500 });
  }
}
