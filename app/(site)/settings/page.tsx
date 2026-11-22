import { redirect } from "next/navigation";
import SettingsPage from "@/features/account/components/settings-page/settings-page";
import { createClient } from "@/db/clients/server";
import { hasSupabasePublicEnv } from "@/db/clients/env";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Podešavanja naloga");

export default async function SettingsRoute() {
  if (!hasSupabasePublicEnv()) {
    redirect("/login?error=supabase_not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings");
  }

  return <SettingsPage />;
}
