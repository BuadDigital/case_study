"use client";

import { useEffect, useRef, useState } from "react";
import { googleMapsApiKey, loadGoogleMapsApi } from "@platform/ui-kit";
import type { ComparablesMapPin } from "../../lib/evaluator/valuation-report-comparables-map";

/**
 * Interactive Google Map for valuation report preview (§18 / §33).
 */
export function ComparablesGoogleMap({
  pins,
  zoom,
  mapTypeId = "hybrid",
  centerLat,
  centerLng,
}: {
  pins: ComparablesMapPin[];
  /** Fixed zoom (e.g. close-up). When omitted, fitBounds is used. */
  zoom?: number;
  mapTypeId?: "hybrid" | "satellite" | "roadmap" | "terrain";
  /** Explicit center — preferred over bounds for §33 single-subject maps. */
  centerLat?: number;
  centerLng?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(() =>
    googleMapsApiKey()
      ? null
      : "أضف NEXT_PUBLIC_GOOGLE_MAPS_API_KEY لتفعيل خريطة Google.",
  );

  useEffect(() => {
    if (!googleMapsApiKey() || !containerRef.current || pins.length === 0) return;

    let cancelled = false;
    let map: google.maps.Map | null = null;
    const markers: google.maps.Marker[] = [];

    loadGoogleMapsApi()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const bounds = new g.maps.LatLngBounds();
        for (const p of pins) {
          bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) });
        }
        const subject = pins.find((p) => p.kind === "subject") ?? pins[0]!;
        const center = {
          lat:
            centerLat != null && Number.isFinite(centerLat)
              ? centerLat
              : Number(subject.lat),
          lng:
            centerLng != null && Number.isFinite(centerLng)
              ? centerLng
              : Number(subject.lng),
        };
        if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
          setError("إحداثيات الخريطة غير صالحة.");
          return;
        }

        const typeId =
          mapTypeId === "satellite"
            ? g.maps.MapTypeId.SATELLITE
            : mapTypeId === "roadmap"
              ? g.maps.MapTypeId.ROADMAP
              : mapTypeId === "terrain"
                ? g.maps.MapTypeId.TERRAIN
                : g.maps.MapTypeId.HYBRID;

        map = new g.maps.Map(containerRef.current, {
          center,
          zoom: zoom ?? (pins.length === 1 ? 16 : 14),
          mapTypeId: typeId,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });
        if (zoom == null && pins.length > 1) {
          map.fitBounds(bounds, 48);
        } else {
          map.setCenter(center);
          if (zoom != null) map.setZoom(zoom);
        }

        for (const p of pins) {
          const isSubject = p.kind === "subject";
          const marker = new g.maps.Marker({
            map,
            position: { lat: Number(p.lat), lng: Number(p.lng) },
            title: p.label,
            label: isSubject
              ? undefined
              : {
                  text: p.label.slice(0, 2),
                  color: "#fff",
                  fontWeight: "700",
                  fontSize: "11px",
                },
            icon: isSubject
              ? {
                  path: g.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#12284C",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                }
              : {
                  path: g.maps.SymbolPath.CIRCLE,
                  scale: 9,
                  fillColor: "#C8B591",
                  fillOpacity: 1,
                  strokeColor: "#12284C",
                  strokeWeight: 1.5,
                },
            zIndex: isSubject ? 1000 : 100,
          });
          markers.push(marker);
        }
        setError(null);
        // Nudge layout after mount (zero-size → wrong tiles is a common Maps bug).
        window.setTimeout(() => {
          if (cancelled || !map) return;
          g.maps.event.trigger(map, "resize");
          map.setCenter(center);
        }, 50);
      })
      .catch(() => {
        if (!cancelled) {
          setError("تعذر تحميل خريطة Google.");
        }
      });

    return () => {
      cancelled = true;
      for (const m of markers) m.setMap(null);
      map = null;
    };
  }, [centerLat, centerLng, mapTypeId, pins, zoom]);

  if (error) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center bg-surface-2 px-4 text-center text-[12px] text-text-3">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-full min-h-[220px] w-full" />;
}
