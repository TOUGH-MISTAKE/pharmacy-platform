export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface SiteConfig {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  url: string;
  /** International format with no spaces, e.g. "+254700000000". Leave "" to hide. */
  phone: string;
  /** Email address shown in the footer. Leave "" to hide. */
  email: string;
  /** Head office or main branch address. Leave "" to hide. */
  address: string;
  /** Pharmacy and Poisons Board licence number. Leave "" to hide. */
  ppbLicenceNo: string;
}

export const siteConfig: SiteConfig = {
  name: "Similife Pharmacy",
  shortName: "Similife",
  tagline: "Advancing everyday health",
  description:
    "Similife Pharmacy: genuine medicines, pharmacist-verified prescriptions, chronic-care refills and delivery or pickup from a branch near you.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  phone: "",
  email: "",
  address: "",
  ppbLicenceNo: "",
};

export const mainNavLinks: NavLink[] = [
  { label: "All products", href: "/products" },
  { label: "Prescriptions", href: "/prescriptions" },
  { label: "Chronic care", href: "/products?category=chronic-care" },
  { label: "Vitamins", href: "/products?category=vitamins-supplements" },
  { label: "Skincare", href: "/products?category=skincare" },
  { label: "Baby & Mum", href: "/products?category=baby-mum" },
  { label: "Branches", href: "/branches" },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "Prescription medicines", href: "/products?category=prescription-medicines" },
      { label: "Chronic care", href: "/products?category=chronic-care" },
      { label: "Vitamins & supplements", href: "/products?category=vitamins-supplements" },
      { label: "Skincare", href: "/products?category=skincare" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Upload a prescription", href: "/prescriptions" },
      { label: "Track my order", href: "/account/orders" },
      { label: "Find a branch", href: "/branches" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
    ],
  },
];
