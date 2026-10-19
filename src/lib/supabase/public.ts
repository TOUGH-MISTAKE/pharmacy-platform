import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for PUBLIC, read-only data (categories, products, branches).
 * It uses the anon key and no cookies, so pages using it can be cached.
 * Row Level Security still applies: it can only read what anonymous visitors may read.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase settings. Open .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
