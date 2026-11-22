import { createClient } from "@/db/clients/server";
import { hasSupabasePublicEnv } from "@/db/clients/env";

export async function getAuthState() {
  if (!hasSupabasePublicEnv()) {
    return {
      isLoggedIn: false,
      user: null,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      isLoggedIn: false,
      user: null,
    };
  }

  return {
    isLoggedIn: true,
    user,
  };
}
