import { redirect } from "next/navigation";
import AddressesPage from "@/features/account/components/addresses-page/addresses-page";
import type { AddressRow } from "@/features/account/types";
import { createClient } from "@/db/clients/server";
import { hasSupabasePublicEnv } from "@/db/clients/env";
import { listAddresses } from "@/db/queries/addresses";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Adrese");

export default async function AddressesRoute() {
  if (!hasSupabasePublicEnv()) {
    redirect("/login?error=supabase_not_configured");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/addresses");
  }

  const { data, error } = await listAddresses(supabase);

  if (error) {
    console.error("Greška pri učitavanju adresa:", error);
  }

  return <AddressesPage initialAddresses={(data ?? []) as AddressRow[]} />;
}