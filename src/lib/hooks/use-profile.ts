"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "patient" | "pharmacist" | "branch_manager" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  branch_id: string | null;
}

export function useProfile() {
  const { loading: authLoading, userId } = useAuthUser();

  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      const { data, error } = await createClient()
        .from("profiles")
        .select("id, full_name, phone, role, branch_id")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Profile | null) ?? null;
    },
  });

  return {
    loading: authLoading || (Boolean(userId) && query.isLoading),
    userId,
    profile: query.data ?? null,
  };
}
