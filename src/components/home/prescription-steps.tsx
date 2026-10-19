import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "1",
    title: "Upload your prescription",
    description: "Take a clear photo or upload a PDF from your doctor.",
  },
  {
    number: "2",
    title: "A pharmacist verifies it",
    description: "We check it and confirm your medicines, usually within a short time.",
  },
  {
    number: "3",
    title: "Pay and receive",
    description: "Pay with M-Pesa or card, then collect in store or get it delivered.",
  },
];

export function PrescriptionSteps() {
  return (
    <section aria-labelledby="rx-heading" className="mx-auto max-w-7xl px-4 pt-14">
      <div className="overflow-hidden rounded-3xl bg-brand-700 px-6 py-10 text-white sm:px-10 sm:py-12">
        <div className="max-w-2xl">
          <h2 id="rx-heading" className="text-2xl font-extrabold sm:text-3xl">
            Prescription medicines, made simple
          </h2>
          <p className="mt-2 text-brand-100">
            No queues and no guesswork. Your prescription is handled safely and kept private.
          </p>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-extrabold text-brand-700">
                {step.number}
              </span>
              <p className="mt-4 text-base font-bold">{step.title}</p>
              <p className="mt-1 text-sm text-brand-100">{step.description}</p>
            </li>
          ))}
        </ol>

        <Link
          href="/prescriptions"
          className={cn(
            buttonVariants({ size: "lg", variant: "secondary" }),
            "mt-8 rounded-full px-6 text-brand-800"
          )}
        >
          Upload a prescription
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
