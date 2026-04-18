import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hasSupabasePublicEnv } from "@/shared/supabase/env";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createClient() {
  if (!hasSupabasePublicEnv() || !supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase nije podešen. Popuni .env.local po primeru iz .env.example."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // ok in Server Components when proxy refreshes session
        }
      },
    },
  });
}
