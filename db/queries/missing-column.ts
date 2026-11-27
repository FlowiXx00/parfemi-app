/**
 * New columns arrive with a migration that the owner runs by hand in Supabase. Until it's run, a
 * select that names a new column fails with "column ... does not exist" (Postgres 42703). Queries the
 * shop can't live without (catalog, orders) then retry with the old column list instead of failing.
 */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}
