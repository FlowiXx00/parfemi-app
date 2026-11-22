"use client";

import { useEffect } from "react";
import Link from "next/link";
import StatusPage, { statusPageStyles as s } from "@/features/content/components/status-page/status-page";

/** Admin error: the sidebar stays and the error digest is shown so it can be found in the logs. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : "";
  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";

  return (
    <StatusPage
      code="500"
      kicker="Greška u adminu"
      title="Ova strana nije mogla da se učita"
      text={message || "Proveri internet vezu i pokušaj ponovo. Ako se ponavlja, kod ispod pomaže da se nađe uzrok."}
      footer={digest ? `Kod greške: ${digest}` : undefined}
    >
      <button type="button" className={s.primary} onClick={() => retry()}>
        Pokušaj ponovo
      </button>
      <Link href="/admin" className={s.secondary}>
        Pregled
      </Link>
    </StatusPage>
  );
}
