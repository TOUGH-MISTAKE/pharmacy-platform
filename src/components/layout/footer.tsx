import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CopyrightYear } from "@/components/layout/copyright-year";
import { footerColumns, siteConfig } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-brand-100 bg-brand-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {siteConfig.tagline}. Genuine medicines, prescriptions verified by a pharmacist, and
            delivery or pickup from a branch near you.
          </p>

          <ul className="mt-5 space-y-2 text-sm text-brand-800">
            {siteConfig.phone ? (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-600" />
                <a href={`tel:${siteConfig.phone}`} className="hover:underline">
                  {siteConfig.phone}
                </a>
              </li>
            ) : null}
            {siteConfig.email ? (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-600" />
                <a href={`mailto:${siteConfig.email}`} className="hover:underline">
                  {siteConfig.email}
                </a>
              </li>
            ) : null}
            {siteConfig.address ? (
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-600" />
                <span>{siteConfig.address}</span>
              </li>
            ) : null}
          </ul>
        </div>

        {footerColumns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-800">
              {column.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-brand-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-brand-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            &copy; <CopyrightYear /> {siteConfig.name}. All rights reserved.
            {siteConfig.ppbLicenceNo
              ? ` Registered with the Pharmacy and Poisons Board, licence no. ${siteConfig.ppbLicenceNo}.`
              : ""}
          </p>
          <p>
            Prescription-only medicines are dispensed only against a valid prescription verified by
            a registered pharmacist. We accept M-Pesa and card payments.
          </p>
        </div>
      </div>
    </footer>
  );
}