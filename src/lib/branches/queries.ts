import { createPublicClient } from "@/lib/supabase/public";
import type { Branch } from "@/lib/branches/types";

interface BranchRow {
  id: string;
  name: string;
  slug: string;
  address: string;
  town: string;
  county: string;
  phone: string | null;
  latitude: number | string;
  longitude: number | string;
  opening_hours: Record<string, string> | null;
  offers_pickup: boolean;
  offers_delivery: boolean;
  has_pharmacist_on_duty: boolean;
  ppb_license_no: string | null;
}

export async function getActiveBranches(): Promise<Branch[]> {
  const { data, error } = await createPublicClient()
    .from("branches")
    .select(
      "id, name, slug, address, town, county, phone, latitude, longitude, opening_hours, offers_pickup, offers_delivery, has_pharmacist_on_duty, ppb_license_no"
    )
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return ((data ?? []) as BranchRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    town: row.town,
    county: row.county,
    phone: row.phone,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    openingHours: row.opening_hours ?? {},
    offersPickup: row.offers_pickup,
    offersDelivery: row.offers_delivery,
    hasPharmacistOnDuty: row.has_pharmacist_on_duty,
    ppbLicenceNo: row.ppb_license_no,
  }));
}
