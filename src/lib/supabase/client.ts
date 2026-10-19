import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for code that runs in the visitor's browser
 * (sign in, sign up, user menu). Uses the anon key; Row Level Security applies.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase settings. Open .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createBrowserClient(url, key);
}
