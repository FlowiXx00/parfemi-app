import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";

export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "auth-check-email",
    limit: 8,
    windowMs: 60_000,
  });

  if (protection) {
    return protection;
  }

  return NextResponse.json({
    ok: true,
    message: "Provera email adrese se radi tokom same registracije.",
  });
}
