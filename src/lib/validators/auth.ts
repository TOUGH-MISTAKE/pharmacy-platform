import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/phone";

export type FieldErrors = Record<string, string>;

/** Collects the first error message for each form field. */
export function collectErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

const emailRule = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("Enter a valid email address");

const passwordRule = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: emailRule,
    phone: z
      .string()
      .trim()
      .refine((value) => normalizeKenyanPhone(value) !== null, {
        message: "Enter a valid Kenyan mobile number, e.g. 0712 345 678",
      }),
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirm your password"),
    consent: z.boolean().refine((value) => value === true, {
      message: "You must accept this to create an account",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailRule,
});

export const resetPasswordSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
