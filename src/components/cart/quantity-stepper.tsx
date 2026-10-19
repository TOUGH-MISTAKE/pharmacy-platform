"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_LINE_QUANTITY } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}

export function QuantityStepper({ value, onChange, label, className }: QuantityStepperProps) {
  const buttonClass =
    "flex h-9 w-9 items-center justify-center text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-full border border-brand-200 bg-white",
        className
      )}
    >
      <button
        type="button"
        aria-label={`Decrease quantity of ${label}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={buttonClass}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="min-w-8 text-center text-sm font-bold text-brand-900"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase quantity of ${label}`}
        disabled={value >= MAX_LINE_QUANTITY}
        onClick={() => onChange(value + 1)}
        className={buttonClass}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
