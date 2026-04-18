import "server-only";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseAdminEnv } from "@/shared/supabase/env";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function buildSupabaseAdmin() {
  if (!hasSupabaseAdminEnv() || !supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase admin nije podešen. Popuni .env.local po primeru iz .env.example."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseAdmin() {
  return buildSupabaseAdmin();
}

export const supabaseAdmin = new Proxy({} as ReturnType<typeof buildSupabaseAdmin>, {
  get(_target, prop, receiver) {
    const client = buildSupabaseAdmin();
    return Reflect.get(client, prop, receiver);
  },
});
