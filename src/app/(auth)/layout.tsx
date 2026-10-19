import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <header className="mx-auto w-full max-w-md px-4 pt-8">
        <Logo />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="font-medium hover:text-brand-600 hover:underline">
            Back to the shop
          </Link>
        </p>
      </main>
    </div>
  );
}
