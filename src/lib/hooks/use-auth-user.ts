"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthUserState {
  loading: boolean;
  userId: string | null;
}

/** Tells a component whether a patient is signed in (updates on sign in / sign out). */
export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ loading: true, userId: null });

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, userId: session?.user?.id ?? null });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
