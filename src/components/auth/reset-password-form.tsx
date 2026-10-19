"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { collectErrors, resetPasswordSchema, type FieldErrors } from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

type LinkState = "checking" | "ready" | "expired";

export function ResetPasswordForm() {
  const router = useRouter();

  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) {
          setLinkState(data.user ? "ready" : "expired");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLinkState("expired");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(collectErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

      if (error) {
        setFormError(friendlyAuthError(error.message));
        setLoading(false);
        return;
      }

      toast.success("Your password has been updated.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setFormError(friendlyAuthError(err instanceof Error ? err.message : ""));
      setLoading(false);
    }
  }

  if (linkState === "checking") {
    return (
      <div className="flex items-center justify-center py-10 text-brand-600">
        <LoaderCircle className="h-6 w-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (linkState === "expired") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-brand-900">This link has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Password reset links work only once and expire after a short time. Please request a new
          one.
        </p>
        <Link
          href="/forgot-password"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full rounded-full")}
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a password you have not used on other websites.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {formError ? <FormAlert message={formError} /> : null}

        <FormField
          id="password"
          label="New password"
          error={errors.password}
          hint="At least 8 characters, with letters and numbers."
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : "password-hint"}
          />
        </FormField>

        <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          />
        </FormField>

        <Button type="submit" size="lg" disabled={loading} className="w-full rounded-full">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </div>
  );
}
