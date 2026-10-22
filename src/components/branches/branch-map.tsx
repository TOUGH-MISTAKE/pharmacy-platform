"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Branch } from "@/lib/branches/types";
import type { Coordinates } from "@/lib/geo";

interface BranchMapProps {
  token: string;
  branches: Branch[];
  selectedId: string | null;
  userLocation: Coordinates | null;
  onSelect: (branchId: string) => void;
}

const loadMapbox = () => import("mapbox-gl").then((module) => module.default);

export function BranchMap({ token, branches, selectedId, userLocation, onSelect }: BranchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;

    void loadMapbox().then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [37.9, 0.2],
        zoom: 5.5,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Draw a pin for each branch
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;

    void loadMapbox().then((mapboxgl) => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();

      const bounds = new mapboxgl.LngLatBounds();
      branches.forEach((branch) => {
        const marker = new mapboxgl.Marker({ color: "#14857f" })
          .setLngLat([branch.longitude, branch.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 28, closeButton: false }).setText(branch.name))
          .addTo(map);

        const element = marker.getElement();
        element.style.cursor = "pointer";
        element.setAttribute("aria-label", `${branch.name} on the map`);
        element.addEventListener("click", () => onSelectRef.current(branch.id));

        markersRef.current.set(branch.id, marker);
        bounds.extend([branch.longitude, branch.latitude]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, branches]);

  // Zoom to the selected branch
  useEffect(() => {
    if (!ready || !mapRef.current || !selectedId) return;
    const branch = branches.find((item) => item.id === selectedId);
    if (!branch) return;
    mapRef.current.flyTo({
      center: [branch.longitude, branch.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 13),
      essential: true,
    });
  }, [ready, selectedId, branches]);

  // Show the shopper's own position
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;

    void loadMapbox().then((mapboxgl) => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      if (userLocation) {
        userMarkerRef.current = new mapboxgl.Marker({ color: "#2563eb" })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 28, closeButton: false }).setText("You are here"))
          .addTo(map);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, userLocation]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of our branches"
      className="h-80 w-full overflow-hidden rounded-2xl border border-brand-100 lg:h-[34rem]"
    />
  );
}
