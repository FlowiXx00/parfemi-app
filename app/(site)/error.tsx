"use client";

import { useEffect } from "react";
import Link from "next/link";
import StatusPage, { statusPageStyles as s } from "@/features/content/components/status-page/status-page";

/** Error on a storefront page: header and footer stay, the customer can retry. */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";

  return (
    <StatusPage
      code="500"
      kicker="Nešto je pošlo naopako"
      title="Stranica trenutno ne radi"
      text="Desila se greška kod nas, ne kod tebe. Korpa je sačuvana — pokušaj ponovo za par sekundi."
      footer={digest ? `Kod greške: ${digest}` : undefined}
    >
      <button type="button" className={s.primary} onClick={() => retry()}>
        Pokušaj ponovo
      </button>
      <Link href="/" className={s.secondary}>
        Početna
      </Link>
    </StatusPage>
  );
}
