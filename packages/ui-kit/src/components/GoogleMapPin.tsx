"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { googleMapsApiKey, loadGoogleMapsApi } from "../lib/google-maps-loader";

const PIN_ZOOM = 16;
const OVERVIEW_ZOOM = 6;
const SAUDI_CENTER = { lat: 24.2, lng: 45.0 };

function parsePin(
  lat?: number | null,
  lng?: number | null,
): { lat: number; lng: number } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function GoogleMapPin({
  lat,
  lng,
  className,
  title = "خريطة موقع العقار",
  interactive = false,
  disabled = false,
  onCoordsChange,
}: {
  lat?: number | null;
  lng?: number | null;
  className?: string;
  title?: string;
  /** Click the map or drag the pin to choose coordinates. */
  interactive?: boolean;
  disabled?: boolean;
  onCoordsChange?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const picking = Boolean(interactive && !disabled && onCoordsChange);
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  const onCoordsChangeRef = useRef(onCoordsChange);
  onCoordsChangeRef.current = onCoordsChange;
  const coordsRef = useRef({ lat, lng });
  coordsRef.current = { lat, lng };
  const [error, setError] = useState<string | null>(() =>
    googleMapsApiKey()
      ? null
      : "أضف NEXT_PUBLIC_GOOGLE_MAPS_API_KEY لتفعيل خريطة Google.",
  );

  useEffect(() => {
    if (!googleMapsApiKey()) return;

    let cancelled = false;
    loadGoogleMapsApi()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const pin = parsePin(coordsRef.current.lat, coordsRef.current.lng);
        const center = pin ?? SAUDI_CENTER;
        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom: pin ? PIN_ZOOM : OVERVIEW_ZOOM,
          mapTypeId: "satellite",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: pickingRef.current ? "greedy" : "cooperative",
        });
        mapRef.current = map;
        const marker = new g.maps.Marker({
          map: pin ? map : undefined,
          position: pin ?? undefined,
          draggable: pickingRef.current,
        });
        markerRef.current = marker;

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!pickingRef.current) return;
          const pos = event.latLng;
          if (!pos) return;
          marker.setMap(map);
          marker.setPosition(pos);
          map.panTo(pos);
          if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
          onCoordsChangeRef.current?.(pos.lat(), pos.lng());
        });

        marker.addListener("dragend", () => {
          if (!pickingRef.current) return;
          const pos = marker.getPosition();
          if (!pos) return;
          onCoordsChangeRef.current?.(pos.lat(), pos.lng());
        });

        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "تعذر تحميل خريطة Google — تحقق من مفتاح API وإعادة تشغيل الواجهة.",
          );
        }
      });

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    markerRef.current?.setDraggable(picking);
  }, [picking]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const pin = parsePin(lat, lng);
    if (!pin) {
      marker.setMap(null);
      return;
    }
    marker.setMap(map);
    marker.setPosition(pin);
    map.panTo(pin);
    if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
  }, [lat, lng]);

  if (error) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-surface-2 px-4 text-center text-[12px] text-text-3",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role={picking ? "application" : "img"}
      aria-label={
        picking ? `${title} — اضغط على الخريطة لتحديد الموقع` : title
      }
      className={cn("h-full w-full", picking && "cursor-crosshair", className)}
    />
  );
}
