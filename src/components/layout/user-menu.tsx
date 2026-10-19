"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
  FileText,
  LogOut,
  ShieldCheck,
  Stethoscope,
  User,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Status = "loading" | "signed_out" | "signed_in";
type Role = "patient" | "pharmacist" | "branch_manager" | "admin";

interface Profile {
  full_name: string;
  role: Role;
}

export function UserMenu() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  // Keep track of who is signed in (updates automatically on sign in / sign out).
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? "");
      setStatus(user ? "signed_in" : "signed_out");
      if (!user) {
        setProfile(null);
        setOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load the patient's name and role once we know who they are.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    createClient()
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setProfile(data as Profile);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Close the menu when clicking elsewhere or pressing Escape.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (status === "loading") {
    return <div aria-hidden className="h-10 w-24 animate-pulse rounded-full bg-brand-100" />;
  }

  if (status === "signed_out") {
    return (
      <Link href="/login" className={cn(buttonVariants(), "rounded-full px-4")}>
        <User className="h-4 w-4" />
        Sign in
      </Link>
    );
  }

  const displayName = profile?.full_name?.trim() || email.split("@")[0] || "Account";
  const firstName = displayName.split(" ")[0];
  const initial = displayName.charAt(0).toUpperCase();
  const role = profile?.role ?? "patient";
  const isPharmacist = role === "pharmacist" || role === "admin";
  const isStaffDashboardUser = role === "admin" || role === "branch_manager";

  const menuLinkClass =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-brand-50";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full border border-brand-200 bg-white pl-1.5 pr-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[7rem] truncate sm:inline">{firstName}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-brand-100 bg-white p-2 shadow-lg"
        >
          <div className="border-b border-brand-100 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-bold text-brand-900">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>

          <div className="py-2">
            <Link
              href="/account/orders"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuLinkClass}
            >
              <ClipboardList className="h-4 w-4 text-brand-600" />
              My orders
            </Link>
            <Link
              href="/account/prescriptions"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuLinkClass}
            >
              <FileText className="h-4 w-4 text-brand-600" />
              My prescriptions
            </Link>
            <Link
              href="/account/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuLinkClass}
            >
              <User className="h-4 w-4 text-brand-600" />
              My profile
            </Link>

            {isPharmacist ? (
              <Link
                href="/pharmacist"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={menuLinkClass}
              >
                <Stethoscope className="h-4 w-4 text-brand-600" />
                Verification queue
              </Link>
            ) : null}

            {isStaffDashboardUser ? (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={menuLinkClass}
              >
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                Staff dashboard
              </Link>
            ) : null}
          </div>

          <div className="border-t border-brand-100 pt-2">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className={cn(menuLinkClass, "w-full text-left text-red-700 hover:bg-red-50")}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
