"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MailCheck } from "lucide-react";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/auth-errors";
import { normalizeKenyanPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import { collectErrors, signupSchema, type FieldErrors } from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

export function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setFormError(null);
    const parsed = signupSchema.safeParse({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      consent,
    });

    if (!parsed.success) {
      setErrors(collectErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
          data: {
            full_name: parsed.data.fullName,
            phone: normalizeKenyanPhone(parsed.data.phone),
            data_consent: true,
          },
        },
      });

      if (error) {
        setFormError(friendlyAuthError(error.message));
        setLoading(false);
        return;
      }

      // When email confirmation is switched off, Supabase signs the user in straight away.
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setSentTo(parsed.data.email);
      setLoading(false);
    } catch (err) {
      setFormError(friendlyAuthError(err instanceof Error ? err.message : ""));
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-brand-900">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>.
          Open it to activate your account. If you already have an account with this email, just
          sign in instead.
        </p>
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full rounded-full")}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Order medicines, upload prescriptions and track every delivery.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {formError ? <FormAlert message={formError} /> : null}

        <FormField id="fullName" label="Full name" error={errors.fullName}>
          <Input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            className="h-11"
          />
        </FormField>

        <FormField id="email" label="Email address" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-11"
          />
        </FormField>

        <FormField
          id="phone"
          label="M-Pesa phone number"
          error={errors.phone}
          hint="We use this for M-Pesa payments and delivery updates."
        >
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
            className="h-11"
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
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

        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          />
        </FormField>

        <div>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? "consent-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 rounded border-brand-300 accent-brand-600"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-brand-600 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-semibold text-brand-600 hover:underline"
              >
                Privacy Policy
              </Link>
              , and I consent to Similife Pharmacy processing my personal and health information
              to fulfil my orders and prescriptions, in line with the Kenya Data Protection Act,
              2019.
            </span>
          </label>
          {errors.consent ? (
            <p id="consent-error" role="alert" className="mt-1.5 text-sm text-destructive">
              {errors.consent}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" disabled={loading} className="w-full rounded-full">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
