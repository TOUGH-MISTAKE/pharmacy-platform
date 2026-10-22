"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Banknote,
  CreditCard,
  LoaderCircle,
  LocateFixed,
  Lock,
  MapPin,
  Smartphone,
  Store,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-field";
import { AddressForm } from "@/components/checkout/address-form";
import { textareaClass } from "@/components/prescriptions/field-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { distanceKm, formatDistance } from "@/lib/geo";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import type { FulfilmentType, PaymentMethod } from "@/lib/orders/types";
import { STATUS_LABELS, type PrescriptionStatus } from "@/lib/prescriptions/types";
import {
  selectHasPrescriptionItems,
  selectSubtotal,
  useCartStore,
} from "@/lib/stores/cart-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface BranchRow {
  id: string;
  name: string;
  town: string;
  address: string;
  offers_pickup: boolean;
  offers_delivery: boolean;
  delivery_fee: number | string;
  free_delivery_threshold: number | string | null;
  latitude: number | string;
  longitude: number | string;
}

interface AddressRow {
  id: string;
  label: string;
  address_line: string;
  town: string;
  county: string;
  is_default: boolean;
}

interface PrescriptionRow {
  id: string;
  status: PrescriptionStatus;
  created_at: string;
  doctor_name: string | null;
  expires_at: string | null;
}

interface DiscountResult {
  discount_id: string | null;
  discount_amount: number | string | null;
  message: string | null;
}

function estimateDeliveryFee(subtotal: number, branch: BranchRow | undefined): number {
  if (!branch) return 0;
  if (
    branch.free_delivery_threshold !== null &&
    subtotal >= Number(branch.free_delivery_threshold)
  ) {
    return 0;
  }
  return Number(branch.delivery_fee);
}

function SectionCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-5">
      <h2 className="flex items-center gap-3 text-base font-extrabold text-brand-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm text-white">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function choiceClass(selected: boolean, disabled = false): string {
  return cn(
    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition",
    selected ? "border-brand-600 bg-brand-50" : "border-brand-200 bg-white hover:border-brand-400",
    disabled && "cursor-not-allowed opacity-50 hover:border-brand-200"
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { loading: authLoading, userId } = useAuthUser();

  const hydrated = useCartStore((state) => state.hydrated);
  const items = useCartStore((state) => state.items);
  const discountCode = useCartStore((state) => state.discountCode);
  const subtotal = useCartStore(selectSubtotal);
  const hasPrescriptionItems = useCartStore(selectHasPrescriptionItems);
  const clearCart = useCartStore((state) => state.clear);

  const [branchId, setBranchId] = useState("");
  const [fulfilment, setFulfilment] = useState<FulfilmentType>("pickup");
  const [addressId, setAddressId] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [prescriptionId, setPrescriptionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const productIds = items.map((item) => item.productId);

  const branchesQuery = useQuery({
    queryKey: ["checkout-branches"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await createClient()
        .from("branches")
        .select(
          "id, name, town, address, offers_pickup, offers_delivery, delivery_fee, free_delivery_threshold, latitude, longitude"
        )
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as BranchRow[];
    },
  });

  const addressesQuery = useQuery({
    queryKey: ["checkout-addresses", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AddressRow[]> => {
      const { data, error } = await createClient()
        .from("addresses")
        .select("id, label, address_line, town, county, is_default")
        .eq("patient_id", userId ?? "")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AddressRow[];
    },
  });

  const prescriptionsQuery = useQuery({
    queryKey: ["checkout-prescriptions", userId],
    enabled: Boolean(userId) && hasPrescriptionItems,
    queryFn: async (): Promise<PrescriptionRow[]> => {
      const { data, error } = await createClient()
        .from("prescriptions")
        .select("id, status, created_at, doctor_name, expires_at")
        .eq("patient_id", userId ?? "")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const now = Date.now();
      return ((data ?? []) as PrescriptionRow[]).filter(
        (row) => !row.expires_at || new Date(row.expires_at).getTime() > now
      );
    },
  });

  const availabilityQuery = useQuery({
    queryKey: ["checkout-availability", productIds],
    enabled: Boolean(userId) && productIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await createClient()
        .from("product_availability")
        .select("branch_id, product_id")
        .in("product_id", productIds)
        .eq("in_stock", true);
      if (error) throw new Error(error.message);
      const counts: Record<string, number> = {};
      ((data ?? []) as { branch_id: string; product_id: string }[]).forEach((row) => {
        counts[row.branch_id] = (counts[row.branch_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const discountQuery = useQuery({
    queryKey: ["checkout-discount", discountCode, subtotal, userId],
    enabled: Boolean(discountCode) && Boolean(userId) && subtotal > 0,
    queryFn: async (): Promise<DiscountResult | null> => {
      const { data, error } = await createClient().rpc("calculate_discount", {
        p_code: discountCode,
        p_subtotal: subtotal,
      });
      if (error) throw new Error(error.message);
      return (data as DiscountResult[] | null)?.[0] ?? null;
    },
  });

  if (authLoading || !hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" aria-hidden>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-brand-100 bg-white p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-brand-900">Sign in to check out</h1>
        <Link
          href="/login?next=/checkout"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-6")}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-brand-100 bg-white p-8 text-center">
        <h1 className="text-xl font-extrabold text-brand-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add something before checking out.</p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-6")}
        >
          Browse products
        </Link>
      </div>
    );
  }

  const branches = branchesQuery.data ?? [];
  const addresses = addressesQuery.data ?? [];
  const prescriptions = prescriptionsQuery.data ?? [];
  const availability = availabilityQuery.data;

  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const effectiveAddressId =
    addressId ||
    addresses.find((address) => address.is_default)?.id ||
    addresses[0]?.id ||
    "";
  const effectivePrescriptionId =
    prescriptionId ||
    prescriptions.find((row) => row.status === "approved")?.id ||
    prescriptions[0]?.id ||
    "";

  const discountRow = discountQuery.data;
  const discountAmount = discountRow?.discount_id ? Number(discountRow.discount_amount ?? 0) : 0;
  const deliveryFee = fulfilment === "delivery" ? estimateDeliveryFee(subtotal, selectedBranch) : 0;
  const total = Math.max(subtotal - discountAmount + deliveryFee, 0);

  function handleBranchChange(id: string) {
    setBranchId(id);
    const branch = branches.find((item) => item.id === id);
    if (!branch) return;
    if (fulfilment === "delivery" && !branch.offers_delivery) {
      setFulfilment("pickup");
    } else if (fulfilment === "pickup" && !branch.offers_pickup && branch.offers_delivery) {
      setFulfilment("delivery");
      if (paymentMethod === "cash_on_pickup") setPaymentMethod("mpesa");
    }
  }

  function handleFindNearest() {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError("Your browser cannot share your location. Please choose a branch below.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const ranked = branches
          .map((branch) => ({
            branch,
            distance: distanceKm(here, {
              latitude: Number(branch.latitude),
              longitude: Number(branch.longitude),
            }),
            hasAllItems: availability ? (availability[branch.id] ?? 0) >= productIds.length : false,
          }))
          .sort((a, b) => a.distance - b.distance);

        const best = ranked.find((item) => item.hasAllItems) ?? ranked[0];
        if (best) {
          handleBranchChange(best.branch.id);
          toast.success(
            best.hasAllItems
              ? `${best.branch.name} is ${formatDistance(best.distance)} away and has all your items.`
              : `${best.branch.name} is the nearest branch (${formatDistance(best.distance)}), but some items may be unavailable.`
          );
        }
        setLocating(false);
      },
      () => {
        setLocateError(
          "We could not get your location. Please allow location access, or choose a branch below."
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  function handleFulfilmentChange(next: FulfilmentType) {
    setFulfilment(next);
    if (next === "delivery" && paymentMethod === "cash_on_pickup") {
      setPaymentMethod("mpesa");
    }
  }

  async function handlePlaceOrder() {
    setFormError(null);

    if (!selectedBranch) {
      setFormError("Please choose a branch.");
      return;
    }
    if (fulfilment === "delivery" && !effectiveAddressId) {
      setFormError("Please add a delivery address.");
      return;
    }
    if (hasPrescriptionItems && !effectivePrescriptionId) {
      setFormError("Your cart has prescription-only items. Please attach a prescription.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await createClient().rpc("place_order", {
      p_branch_id: selectedBranch.id,
      p_fulfilment: fulfilment,
      p_payment_method: paymentMethod,
      p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      p_address_id: fulfilment === "delivery" ? effectiveAddressId : null,
      p_prescription_id: hasPrescriptionItems ? effectivePrescriptionId : null,
      p_discount_code: discountCode,
      p_notes: notes.trim() || null,
    });

    if (error || !data) {
      setFormError(error?.message ?? "We could not place your order. Please try again.");
      setSubmitting(false);
      return;
    }

    const orderId = String(data);
    clearCart();
    void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    toast.success("Your order has been placed.");
    router.replace(`/account/orders/${orderId}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Checkout</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-5">
          <SectionCard number={1} title="Choose your branch">
            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleFindNearest}
                disabled={locating || branches.length === 0}
                className="rounded-full border-brand-300 text-brand-700 hover:bg-brand-50"
              >
                {locating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                {locating ? "Finding you..." : "Find the nearest branch with my items"}
              </Button>
              {locateError ? (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {locateError}
                </p>
              ) : null}
            </div>
            {branchesQuery.isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : branchesQuery.isError ? (
              <FormAlert message="We could not load the branches. Please refresh the page." />
            ) : (
              <div role="radiogroup" aria-label="Branch" className="space-y-3">
                {branches.map((branch) => {
                  const inStockCount = availability ? (availability[branch.id] ?? 0) : null;
                  const allInStock = inStockCount !== null && inStockCount >= productIds.length;
                  return (
                    <label key={branch.id} className={choiceClass(branchId === branch.id)}>
                      <input
                        type="radio"
                        name="branch"
                        checked={branchId === branch.id}
                        onChange={() => handleBranchChange(branch.id)}
                        className="mt-1 accent-brand-600"
                      />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-brand-900">{branch.name}</span>
                          {inStockCount !== null ? (
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold",
                                allInStock
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-900"
                              )}
                            >
                              {allInStock ? "All items in stock" : "Some items may be unavailable"}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {branch.address}, {branch.town}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard number={2} title="Pickup or delivery">
            <div role="radiogroup" aria-label="Fulfilment" className="grid gap-3 sm:grid-cols-2">
              <label
                className={choiceClass(
                  fulfilment === "pickup",
                  Boolean(selectedBranch && !selectedBranch.offers_pickup)
                )}
              >
                <input
                  type="radio"
                  name="fulfilment"
                  checked={fulfilment === "pickup"}
                  disabled={Boolean(selectedBranch && !selectedBranch.offers_pickup)}
                  onChange={() => handleFulfilmentChange("pickup")}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-brand-900">
                    <Store className="h-4 w-4 text-brand-600" />
                    Pick up in store
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Free</span>
                </span>
              </label>

              <label
                className={choiceClass(
                  fulfilment === "delivery",
                  Boolean(selectedBranch && !selectedBranch.offers_delivery)
                )}
              >
                <input
                  type="radio"
                  name="fulfilment"
                  checked={fulfilment === "delivery"}
                  disabled={Boolean(selectedBranch && !selectedBranch.offers_delivery)}
                  onChange={() => handleFulfilmentChange("delivery")}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-brand-900">
                    <Truck className="h-4 w-4 text-brand-600" />
                    Delivery
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {selectedBranch
                      ? estimateDeliveryFee(subtotal, selectedBranch) === 0
                        ? "Free delivery on this order"
                        : `${formatKes(estimateDeliveryFee(subtotal, selectedBranch))} delivery fee`
                      : "Fee shown once you choose a branch"}
                  </span>
                </span>
              </label>
            </div>

            {fulfilment === "delivery" ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-bold text-brand-900">Delivery address</p>

                {addressesQuery.isLoading ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : (
                  <>
                    {addresses.length > 0 && !addingAddress ? (
                      <div role="radiogroup" aria-label="Delivery address" className="space-y-2">
                        {addresses.map((address) => (
                          <label
                            key={address.id}
                            className={choiceClass(effectiveAddressId === address.id)}
                          >
                            <input
                              type="radio"
                              name="address"
                              checked={effectiveAddressId === address.id}
                              onChange={() => setAddressId(address.id)}
                              className="mt-1 accent-brand-600"
                            />
                            <span>
                              <span className="font-bold text-brand-900">{address.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {address.address_line}, {address.town}, {address.county}
                              </span>
                            </span>
                          </label>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddingAddress(true)}
                          className="rounded-full"
                        >
                          Add a new address
                        </Button>
                      </div>
                    ) : (
                      <AddressForm
                        userId={userId}
                        onSaved={(id) => {
                          setAddressId(id);
                          setAddingAddress(false);
                          void queryClient.invalidateQueries({ queryKey: ["checkout-addresses"] });
                        }}
                        onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
                      />
                    )}
                  </>
                )}
              </div>
            ) : null}
          </SectionCard>

          {hasPrescriptionItems ? (
            <SectionCard number={3} title="Attach your prescription">
              {prescriptionsQuery.isLoading ? (
                <Skeleton className="h-20 w-full rounded-xl" />
              ) : prescriptions.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">You have no valid prescription on file.</p>
                  <p className="mt-1">
                    Your cart contains prescription-only medicines. Upload your prescription, then
                    come back here. Your cart is saved.
                  </p>
                  <Link
                    href="/prescriptions"
                    className={cn(buttonVariants({ size: "sm" }), "mt-3 rounded-full")}
                  >
                    Upload a prescription
                  </Link>
                </div>
              ) : (
                <div role="radiogroup" aria-label="Prescription" className="space-y-2">
                  {prescriptions.map((row) => (
                    <label key={row.id} className={choiceClass(effectivePrescriptionId === row.id)}>
                      <input
                        type="radio"
                        name="prescription"
                        checked={effectivePrescriptionId === row.id}
                        onChange={() => setPrescriptionId(row.id)}
                        className="mt-1 accent-brand-600"
                      />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-brand-900">
                            Uploaded {format(new Date(row.created_at), "d MMM yyyy")}
                            {row.doctor_name ? ` - ${row.doctor_name}` : ""}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold",
                              row.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-900"
                            )}
                          >
                            {STATUS_LABELS[row.status]}
                          </span>
                        </span>
                        {row.status === "pending" ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Your order will wait until a pharmacist approves this prescription.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          <SectionCard number={hasPrescriptionItems ? 4 : 3} title="Payment method">
            <div role="radiogroup" aria-label="Payment method" className="space-y-3">
              <label className={choiceClass(paymentMethod === "mpesa")}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "mpesa"}
                  onChange={() => setPaymentMethod("mpesa")}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-brand-900">
                    <Smartphone className="h-4 w-4 text-brand-600" />
                    M-Pesa
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    You will get a payment prompt on your phone.
                  </span>
                </span>
              </label>

              <label className={choiceClass(paymentMethod === "card")}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "card"}
                  onChange={() => setPaymentMethod("card")}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-brand-900">
                    <CreditCard className="h-4 w-4 text-brand-600" />
                    Credit or debit card
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Visa and Mastercard.
                  </span>
                </span>
              </label>

              <label className={choiceClass(paymentMethod === "cash_on_pickup", fulfilment !== "pickup")}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "cash_on_pickup"}
                  disabled={fulfilment !== "pickup"}
                  onChange={() => setPaymentMethod("cash_on_pickup")}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-brand-900">
                    <Banknote className="h-4 w-4 text-brand-600" />
                    Pay when you collect
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Available for store pickup only.
                  </span>
                </span>
              </label>
            </div>
          </SectionCard>

          <section className="rounded-2xl border border-brand-100 bg-white p-5">
            <label htmlFor="order-notes" className="text-sm font-bold text-brand-900">
              Order notes (optional)
            </label>
            <textarea
              id="order-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={300}
              placeholder="Anything we should know about this order."
              className={cn(textareaClass, "mt-2")}
            />
          </section>
        </div>

        <aside className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 lg:sticky lg:top-40">
          <h2 className="text-lg font-extrabold text-brand-900">Your order</h2>

          <ul className="space-y-2 border-b border-brand-100 pb-4 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {item.quantity} x {item.name}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatKes(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-b border-brand-100 pb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatKes(subtotal)}</span>
            </div>
            {discountAmount > 0 ? (
              <div className="flex justify-between text-brand-700">
                <span>Discount ({discountCode})</span>
                <span className="font-semibold">-{formatKes(discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span className="font-semibold">
                {fulfilment === "pickup" ? "Free" : deliveryFee === 0 ? "Free" : formatKes(deliveryFee)}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-brand-900">Total</span>
            <span className="text-xl font-extrabold text-brand-900">{formatKes(total)}</span>
          </div>

          {formError ? <FormAlert message={formError} /> : null}

          <Button
            type="button"
            size="lg"
            onClick={handlePlaceOrder}
            disabled={submitting}
            className="w-full rounded-full"
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Placing order..." : "Place order"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Final prices, stock and any discount are confirmed by our system when you place the order.
          </p>
        </aside>
      </div>
    </div>
  );
}
