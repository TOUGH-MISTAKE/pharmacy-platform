"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { selectClass } from "@/components/prescriptions/field-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { FieldErrors } from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

interface DiscountRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  value: number | string;
  min_order_amount: number | string;
  max_discount_amount: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

interface FormState {
  code: string;
  description: string;
  type: "percentage" | "fixed";
  value: string;
  minOrder: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
}

const EMPTY: FormState = {
  code: "",
  description: "",
  type: "percentage",
  value: "",
  minOrder: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
};

function describeValue(row: DiscountRow): string {
  const value = Number(row.value);
  return row.discount_type === "percentage" ? `${value}% off` : `${formatKes(value)} off`;
}

function statusOf(row: DiscountRow, now: number): { label: string; style: string } {
  if (!row.is_active) return { label: "Switched off", style: "bg-gray-200 text-gray-700" };
  if (row.ends_at && new Date(row.ends_at).getTime() < now) {
    return { label: "Expired", style: "bg-gray-200 text-gray-700" };
  }
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    return { label: "Scheduled", style: "bg-amber-100 text-amber-900" };
  }
  if (row.usage_limit !== null && row.used_count >= row.usage_limit) {
    return { label: "Fully used", style: "bg-gray-200 text-gray-700" };
  }
  return { label: "Active", style: "bg-green-100 text-green-800" };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const code = form.code.trim().toUpperCase();

  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
    errors.code = "Use 3 to 20 letters, numbers or dashes, with no spaces. Example: WELCOME10";
  }

  const value = Number(form.value);
  if (form.value.trim() === "" || !Number.isFinite(value) || value <= 0) {
    errors.value = "Enter an amount greater than zero.";
  } else if (form.type === "percentage" && value > 100) {
    errors.value = "A percentage cannot be more than 100.";
  }

  if (form.minOrder.trim() !== "" && (!Number.isFinite(Number(form.minOrder)) || Number(form.minOrder) < 0)) {
    errors.minOrder = "Enter 0 or more, or leave it empty.";
  }
  if (form.maxDiscount.trim() !== "" && (!Number.isFinite(Number(form.maxDiscount)) || Number(form.maxDiscount) <= 0)) {
    errors.maxDiscount = "Enter an amount greater than zero, or leave it empty.";
  }
  if (form.usageLimit.trim() !== "") {
    const limit = Number(form.usageLimit);
    if (!Number.isInteger(limit) || limit < 1) {
      errors.usageLimit = "Enter a whole number of 1 or more, or leave it empty.";
    }
  }
  if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
    errors.endsAt = "The end must be after the start.";
  }

  return errors;
}

export function DiscountManager() {
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-discounts"],
    queryFn: async (): Promise<DiscountRow[]> => {
      const { data, error } = await createClient()
        .from("discounts")
        .select(
          "id, code, description, discount_type, value, min_order_amount, max_discount_amount, starts_at, ends_at, usage_limit, used_count, is_active"
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as DiscountRow[];
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-discounts"] });
  }

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await createClient()
        .from("discounts")
        .insert({
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || null,
          discount_type: form.type,
          value: Number(form.value),
          min_order_amount: form.minOrder.trim() === "" ? 0 : Number(form.minOrder),
          max_discount_amount: form.maxDiscount.trim() === "" ? null : Number(form.maxDiscount),
          starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          usage_limit: form.usageLimit.trim() === "" ? null : Number(form.usageLimit),
          is_active: true,
        });
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "A discount with that code already exists. Choose another code."
            : error.message
        );
      }
    },
    onSuccess: () => {
      toast.success("Discount code created.");
      setForm(EMPTY);
      setErrors({});
      setFormError(null);
      setShowForm(false);
      refresh();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { data, error } = await createClient()
        .from("discounts")
        .update({ is_active: input.isActive })
        .eq("id", input.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("You do not have permission to change discounts.");
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await createClient().from("discounts").delete().eq("id", id).select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("You do not have permission to delete discounts.");
    },
    onSuccess: () => {
      toast.success("Discount code deleted.");
      setDeletingId(null);
      refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setDeletingId(null);
    },
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    setFormError(null);

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    create.mutate();
  }

  const rows = query.data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Discount codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers type these in their cart. The system checks every code again when the order is placed.
          </p>
        </div>
        {!showForm ? (
          <Button type="button" onClick={() => setShowForm(true)} className="rounded-full">
            <Plus className="h-4 w-4" />
            New code
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 space-y-4 rounded-2xl border-2 border-brand-200 bg-white p-5"
        >
          <h2 className="text-base font-extrabold text-brand-900">New discount code</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="d-code" label="Code" error={errors.code} hint="What customers type. Not case sensitive.">
              <Input
                id="d-code"
                value={form.code}
                onChange={(event) => setField("code", event.target.value.toUpperCase())}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "d-code-error" : "d-code-hint"}
                className="h-11 uppercase"
              />
            </FormField>
            <FormField id="d-desc" label="Note for yourself (optional)">
              <Input
                id="d-desc"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="e.g. Christmas promotion"
                className="h-11"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="d-type" label="Type">
              <select
                id="d-type"
                value={form.type}
                onChange={(event) => setField("type", event.target.value as "percentage" | "fixed")}
                className={selectClass}
              >
                <option value="percentage">Percentage off (%)</option>
                <option value="fixed">Fixed amount off (KES)</option>
              </select>
            </FormField>
            <FormField
              id="d-value"
              label={form.type === "percentage" ? "Percentage" : "Amount (KES)"}
              error={errors.value}
            >
              <Input
                id="d-value"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.value}
                onChange={(event) => setField("value", event.target.value)}
                aria-invalid={Boolean(errors.value)}
                aria-describedby={errors.value ? "d-value-error" : undefined}
                className="h-11"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="d-min" label="Minimum order (KES)" error={errors.minOrder} hint="Leave empty for none.">
              <Input
                id="d-min"
                type="number"
                min={0}
                inputMode="decimal"
                value={form.minOrder}
                onChange={(event) => setField("minOrder", event.target.value)}
                className="h-11"
              />
            </FormField>
            <FormField
              id="d-max"
              label="Maximum discount (KES)"
              error={errors.maxDiscount}
              hint="Caps a percentage code."
            >
              <Input
                id="d-max"
                type="number"
                min={0}
                inputMode="decimal"
                value={form.maxDiscount}
                onChange={(event) => setField("maxDiscount", event.target.value)}
                className="h-11"
              />
            </FormField>
            <FormField
              id="d-limit"
              label="Total uses allowed"
              error={errors.usageLimit}
              hint="Leave empty for unlimited."
            >
              <Input
                id="d-limit"
                type="number"
                min={1}
                inputMode="numeric"
                value={form.usageLimit}
                onChange={(event) => setField("usageLimit", event.target.value)}
                className="h-11"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="d-start" label="Starts (optional)">
              <Input
                id="d-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setField("startsAt", event.target.value)}
                className="h-11"
              />
            </FormField>
            <FormField id="d-end" label="Ends (optional)" error={errors.endsAt}>
              <Input
                id="d-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setField("endsAt", event.target.value)}
                aria-invalid={Boolean(errors.endsAt)}
                aria-describedby={errors.endsAt ? "d-end-error" : undefined}
                className="h-11"
              />
            </FormField>
          </div>

          {formError ? <FormAlert message={formError} /> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={create.isPending} className="rounded-full">
              {create.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Create code
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY);
                setErrors({});
                setFormError(null);
              }}
              className="rounded-full"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6">
        {query.isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            We could not load the discount codes. Please refresh the page.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center text-sm text-muted-foreground">
            No discount codes yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const status = statusOf(row, now);
              const details = [
                Number(row.min_order_amount) > 0 ? `Min order ${formatKes(Number(row.min_order_amount))}` : null,
                row.max_discount_amount !== null ? `Max ${formatKes(Number(row.max_discount_amount))} off` : null,
                row.starts_at ? `From ${format(new Date(row.starts_at), "d MMM yyyy")}` : null,
                row.ends_at ? `Until ${format(new Date(row.ends_at), "d MMM yyyy")}` : null,
              ].filter(Boolean);

              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand-900">
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-brand-800">
                        {row.code}
                      </span>
                      {describeValue(row)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used {row.used_count}
                      {row.usage_limit !== null ? ` of ${row.usage_limit}` : " times"}
                      {details.length > 0 ? ` - ${details.join(" - ")}` : ""}
                    </p>
                    {row.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                    ) : null}
                  </div>

                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", status.style)}>
                    {status.label}
                  </span>

                  {deletingId === row.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-brand-900">Delete this code?</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(row.id)}
                        className="rounded-full border-red-300 text-red-700 hover:bg-red-50"
                      >
                        Yes, delete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(null)}
                        className="rounded-full"
                      >
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id: row.id, isActive: !row.is_active })}
                        className="rounded-full"
                      >
                        {row.is_active ? "Switch off" : "Switch on"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(row.id)}
                        className="rounded-full text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
