import "server-only";
import { createClient } from "@supabase/supabase-js";
import { hasSupabaseAdminEnv } from "@/db/clients/env";

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

type SupabaseAdminClient = ReturnType<typeof buildSupabaseAdmin>;

// One client per server process (created lazily so the build doesn't fail when env isn't set).
let adminClient: SupabaseAdminClient | null = null;

function getAdminClient() {
  adminClient ??= buildSupabaseAdmin();
  return adminClient;
}

export const supabaseAdmin = new Proxy({} as SupabaseAdminClient, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
