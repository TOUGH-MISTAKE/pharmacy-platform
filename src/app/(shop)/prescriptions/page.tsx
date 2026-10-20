import type { Metadata } from "next";
import { Camera, Lock, ShieldCheck } from "lucide-react";
import { UploadForm } from "@/components/prescriptions/upload-form";

export const metadata: Metadata = {
  title: "Upload a prescription",
  description: "Upload your prescription securely. A registered pharmacist verifies it before we dispense.",
};

const tips = [
  {
    icon: Camera,
    title: "Take a clear photo",
    text: "Lay the prescription flat in good light. Make sure every line is readable.",
  },
  {
    icon: ShieldCheck,
    title: "Show the whole page",
    text: "Include the doctor's name, stamp, signature and the date.",
  },
  {
    icon: Lock,
    title: "Kept private",
    text: "Only you and the pharmacists who verify it can see your prescription.",
  },
];

export default function PrescriptionsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Upload a prescription</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        A registered pharmacist reviews every prescription before any medicine is dispensed. You
        will see the result under My prescriptions.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <UploadForm />

        <aside className="space-y-4">
          {tips.map((tip) => (
            <div
              key={tip.title}
              className="flex gap-3 rounded-2xl border border-brand-100 bg-white p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <tip.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-900">{tip.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{tip.text}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
