import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Database client that uses the service role key. It bypasses Row Level Security,
 * so it must only be used inside Edge Functions, after the caller has been verified.
 */
export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing in this Edge Function.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
