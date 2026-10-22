"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, LocateFixed, LoaderCircle, MapPin, Navigation, Phone, Search, Stethoscope, Store, Truck } from "lucide-react";
import { BranchMap } from "@/components/branches/branch-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKenyanPhone, phoneHref } from "@/lib/branches/format";
import { hoursRows, isOpenNow } from "@/lib/branches/hours";
import type { Branch } from "@/lib/branches/types";
import { directionsUrl, distanceKm, formatDistance, type Coordinates } from "@/lib/geo";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function BranchLocator({ branches }: { branches: Branch[] }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Opening status depends on the current time, so it is worked out in the browser only.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = branches.filter((branch) =>
      term === ""
        ? true
        : [branch.name, branch.town, branch.county, branch.address].some((field) =>
            field.toLowerCase().includes(term)
          )
    );

    const withDistance = filtered.map((branch) => ({
      branch,
      distance: userLocation ? distanceKm(userLocation, branch) : null,
    }));

    return withDistance.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      return a.branch.name.localeCompare(b.branch.name);
    });
  }, [branches, search, userLocation]);

  function handleLocate() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Your browser cannot share your location. Please search for your town instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(here);
        setLocating(false);

        const nearest = [...branches].sort(
          (a, b) => distanceKm(here, a) - distanceKm(here, b)
        )[0];
        if (nearest) setSelectedId(nearest.id);
      },
      () => {
        setLocating(false);
        setLocationError(
          "We could not get your location. Please allow location access in your browser, or search for your town."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr] lg:items-start">
      <div className="order-2 space-y-4 lg:order-1">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by town, county or branch"
              aria-label="Search branches"
              className="h-11 rounded-full border-brand-200 bg-white pl-10"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleLocate}
            disabled={locating}
            className="w-full rounded-full border-brand-300 text-brand-700 hover:bg-brand-50"
          >
            {locating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            {locating ? "Finding you..." : "Use my location"}
          </Button>

          {locationError ? (
            <p role="alert" className="text-sm text-destructive">
              {locationError}
            </p>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-brand-100 bg-white p-8 text-center text-sm text-muted-foreground">
            No branches match your search.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ branch, distance }, index) => {
              const open = now ? isOpenNow(branch.openingHours, now) : null;
              const selected = selectedId === branch.id;

              return (
                <li key={branch.id}>
                  <article
                    onClick={() => setSelectedId(branch.id)}
                    className={cn(
                      "cursor-pointer rounded-2xl border bg-white p-4 transition",
                      selected
                        ? "border-brand-600 shadow-md"
                        : "border-brand-100 hover:border-brand-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-extrabold text-brand-900">{branch.name}</h2>
                        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            {branch.address}, {branch.town}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {distance !== null ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                            {formatDistance(distance)}
                            {index === 0 ? " - nearest" : ""}
                          </span>
                        ) : null}
                        {open !== null ? (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-bold",
                              open ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                            )}
                          >
                            {open ? "Open now" : "Closed now"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-brand-800">
                      {branch.offersPickup ? (
                        <li className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
                          <Store className="h-3 w-3" />
                          Pickup
                        </li>
                      ) : null}
                      {branch.offersDelivery ? (
                        <li className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
                          <Truck className="h-3 w-3" />
                          Delivery
                        </li>
                      ) : null}
                      {branch.hasPharmacistOnDuty ? (
                        <li className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
                          <Stethoscope className="h-3 w-3" />
                          Pharmacist on duty
                        </li>
                      ) : null}
                    </ul>

                    {Object.keys(branch.openingHours).length > 0 ? (
                      <dl className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                        {hoursRows(branch.openingHours).map((row) => (
                          <div key={row.label} className="flex items-center gap-2">
                            <Clock className="h-3 w-3 shrink-0" />
                            <dt className="w-32 shrink-0">{row.label}</dt>
                            <dd className="font-semibold text-foreground">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    {branch.ppbLicenceNo ? (
                      <p className="mt-2 text-[0.7rem] text-muted-foreground">
                        PPB licence no. {branch.ppbLicenceNo}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={directionsUrl(branch)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Directions
                      </a>
                      {branch.phone ? (
                        <a
                          href={phoneHref(branch.phone)}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {formatKenyanPhone(branch.phone)}
                        </a>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="order-1 lg:order-2 lg:sticky lg:top-40">
        {MAPBOX_TOKEN ? (
          <BranchMap
            token={MAPBOX_TOKEN}
            branches={branches}
            selectedId={selectedId}
            userLocation={userLocation}
            onSelect={setSelectedId}
          />
        ) : (
          <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-6 text-center lg:h-[34rem]">
            <MapPin className="h-8 w-8 text-brand-400" />
            <p className="text-sm font-bold text-brand-900">The map is not switched on yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              You can still find a branch in the list and tap Directions to open it in Google Maps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
