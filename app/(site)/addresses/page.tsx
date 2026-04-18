import { redirect } from "next/navigation";
import AddressesPage from "@/features/account/components/addresses-page/addresses-page";
import type { AddressRow } from "@/features/account/types";
import { createClient } from "@/shared/supabase/supabase-server";
import { hasSupabasePublicEnv } from "@/shared/supabase/env";

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

  const { data, error } = await supabase
    .from("user_addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Greška pri učitavanju adresa:", error);
  }

  return <AddressesPage initialAddresses={(data ?? []) as AddressRow[]} />;
}