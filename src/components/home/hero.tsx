import Link from "next/link";
import { ArrowRight, FileUp, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const quickActions = [
  {
    title: "Upload a prescription",
    description: "Take a photo or upload a PDF. A pharmacist verifies it for you.",
    href: "/prescriptions",
    icon: FileUp,
  },
  {
    title: "Refill my medicine",
    description: "Set up regular refills for chronic-care medicines.",
    href: "/products?category=chronic-care",
    icon: RefreshCw,
  },
  {
    title: "Find the nearest branch",
    description: "Pick up in store or get delivery from the closest branch.",
    href: "/branches",
    icon: MapPin,
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 md:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pharmacist-verified prescriptions
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-brand-900 sm:text-5xl lg:text-6xl">
            Advancing everyday health,{" "}
            <span className="text-brand-600">delivered to you.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Order genuine medicines, upload your prescription in seconds and pay with M-Pesa or
            card. Collect from a branch near you or have it delivered.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}
            >
              Shop medicines
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/prescriptions"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "rounded-full border-brand-300 bg-white px-6 text-brand-700 hover:bg-brand-50"
              )}
            >
              <FileUp className="h-4 w-4" />
              Upload prescription
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-start gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <action.icon className="h-6 w-6" />
              </span>
              <span className="flex-1">
                <span className="block text-base font-bold text-brand-900">{action.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {action.description}
                </span>
              </span>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand-400 transition group-hover:translate-x-1 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
