import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { ImportError } from "@/features/admin/perfumes/server/safe-fetch";
import {
  isScentAiEnabled,
  readScentFromImages,
  type ScentImage,
} from "@/features/admin/perfumes/server/scent-from-image";
import { protectMutationRoute } from "@/lib/request-security";

// Reading images with the AI model can take around ten seconds.
export const maxDuration = 60;

/** Whether the AI feature is enabled (the admin form only shows the button if it is). */
export async function GET() {
  const auth = await requireAdminFromCookies({ allowDemo: true });
  if (auth.ok === false) return auth.response;
  return NextResponse.json({ enabled: isScentAiEnabled() });
}

/** Images (base64) -> notes, accords, when to wear. Nothing is saved until the admin clicks "Save". */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-perfumes-scent-ai",
    limit: 20,
    windowMs: 60_000,
  });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  let body: { images?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const images: ScentImage[] = Array.isArray(body.images)
    ? body.images
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          mediaType: String(item.mediaType ?? "") as ScentImage["mediaType"],
          data: typeof item.data === "string" ? item.data : "",
        }))
    : [];

  try {
    const result = await readScentFromImages(images, typeof body.name === "string" ? body.name : "");
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[scent-from-image]", error);
    return NextResponse.json({ error: "AI čitanje nije uspelo. Popuni ručno." }, { status: 500 });
  }
}
