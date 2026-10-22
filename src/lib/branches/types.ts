export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string;
  town: string;
  county: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  openingHours: Record<string, string>;
  offersPickup: boolean;
  offersDelivery: boolean;
  hasPharmacistOnDuty: boolean;
  ppbLicenceNo: string | null;
}
