"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeKenyanPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

interface AddressFormProps {
  userId: string;
  onSaved: (addressId: string) => void;
  onCancel?: () => void;
}

export function AddressForm({ userId, onSaved, onCancel }: AddressFormProps) {
  const [label, setLabel] = useState("Home");
  const [addressLine, setAddressLine] = useState("");
  const [town, setTown] = useState("");
  const [county, setCounty] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);

    if (addressLine.trim().length < 5) {
      setError("Please enter the street, building or landmark where we should deliver.");
      return;
    }
    if (!town.trim() || !county.trim()) {
      setError("Please enter the town and county.");
      return;
    }
    const normalizedPhone = phone.trim() ? normalizeKenyanPhone(phone) : null;
    if (phone.trim() && !normalizedPhone) {
      setError("Enter a valid Kenyan phone number, e.g. 0712 345 678.");
      return;
    }

    setSaving(true);
    const { data, error: insertError } = await createClient()
      .from("addresses")
      .insert({
        patient_id: userId,
        label: label.trim() || "Home",
        address_line: addressLine.trim(),
        town: town.trim(),
        county: county.trim(),
        phone: normalizedPhone,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError("We could not save this address. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved((data as { id: string }).id);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
      {error ? <FormAlert message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="addr-label" label="Label">
          <Input
            id="addr-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Home, Work..."
            className="h-11 bg-white"
          />
        </FormField>
        <FormField id="addr-phone" label="Contact phone (optional)">
          <Input
            id="addr-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0712 345 678"
            className="h-11 bg-white"
          />
        </FormField>
      </div>

      <FormField id="addr-line" label="Street, building or landmark">
        <Input
          id="addr-line"
          value={addressLine}
          onChange={(event) => setAddressLine(event.target.value)}
          placeholder="e.g. Woodvale Grove, Apartment 4B"
          className="h-11 bg-white"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="addr-town" label="Town or estate">
          <Input
            id="addr-town"
            value={town}
            onChange={(event) => setTown(event.target.value)}
            className="h-11 bg-white"
          />
        </FormField>
        <FormField id="addr-county" label="County">
          <Input
            id="addr-county"
            value={county}
            onChange={(event) => setCounty(event.target.value)}
            className="h-11 bg-white"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={saving} className="rounded-full">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Save address
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            className="rounded-full"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
