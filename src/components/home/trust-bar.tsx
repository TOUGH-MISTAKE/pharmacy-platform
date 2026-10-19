import { BadgeCheck, Smartphone, Truck, Stethoscope } from "lucide-react";

const items = [
  {
    title: "Qualified pharmacists",
    description: "Every prescription is checked before it is dispensed.",
    icon: Stethoscope,
  },
  {
    title: "Genuine products",
    description: "Sourced from trusted, licensed suppliers.",
    icon: BadgeCheck,
  },
  {
    title: "M-Pesa and card",
    description: "Pay securely with the method you prefer.",
    icon: Smartphone,
  },
  {
    title: "Delivery or pickup",
    description: "From the branch closest to you.",
    icon: Truck,
  },
];

export function TrustBar() {
  return (
    <section aria-label="Why choose us" className="border-y border-brand-100 bg-white">
      <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-brand-900">{item.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
