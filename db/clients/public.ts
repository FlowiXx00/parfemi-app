import { createClient } from "@supabase/supabase-js";

/**
 * Public (anon) client without cookies or session.
 * Used only for reading the public catalog (e.g. sitemap, shop pages),
 * since it doesn't depend on the user, which lets Next cache it / render it statically.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase catalog env vars are missing.");
}

export const publicClient = createClient(supabaseUrl, supabaseAnonKey);
