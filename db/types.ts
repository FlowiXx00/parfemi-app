import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Any Supabase client (browser, server with cookies, admin service-role).
 * Every function in `db/queries` takes it as the first argument, so the caller
 * decides which privileges the query runs with.
 */
export type Db = SupabaseClient;
