"use client";

import { useEffect, useRef, useState } from "react";
import {
  googleMapsApiKey,
  googleMapsSearchUrl,
  loadGoogleMapsApi,
  parseCoord,
} from "../lib/google-maps-loader";
import { Skeleton } from "@platform/design-system";
import { JEDDAH_DEFAULT_CENTER } from "../lib/jeddah-default-coords";

const DEFAULT_CENTER = JEDDAH_DEFAULT_CENTER;
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 17;

type EngineeringSurveyMapProps = {
  latitude: string;
  longitude: string;
  disabled?: boolean;
  onCoordsChange: (lat: string, lng: string) => void;
};

export function EngineeringSurveyMap({
  latitude,
  longitude,
  disabled,
  onCoordsChange,
}: EngineeringSurveyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  const hasPin = lat !== null && lng !== null;

  useEffect(() => {
    if (!googleMapsApiKey()) {
      setMapError("أضف NEXT_PUBLIC_GOOGLE_MAPS_API_KEY لتفعيل خريطة Google.");
      return;
    }

    let cancelled = false;

    loadGoogleMapsApi()
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        const center = hasPin ? { lat: lat!, lng: lng! } : DEFAULT_CENTER;
        const zoom = hasPin ? PIN_ZOOM : DEFAULT_ZOOM;

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: disabled ? "none" : "greedy",
        });

        mapRef.current = map;

        const marker = new google.maps.Marker({
          map: hasPin ? map : undefined,
          position: hasPin ? center : undefined,
          draggable: !disabled,
        });
        markerRef.current = marker;

        if (!disabled) {
          map.addListener("click", (event: google.maps.MapMouseEvent) => {
            const pos = event.latLng;
            if (!pos) return;
            marker.setMap(map);
            marker.setPosition(pos);
            map.panTo(pos);
            if (map.getZoom()! < PIN_ZOOM) map.setZoom(PIN_ZOOM);
            onCoordsChange(pos.lat().toFixed(6), pos.lng().toFixed(6));
          });

          marker.addListener("dragend", () => {
            const pos = marker.getPosition();
            if (!pos) return;
            onCoordsChange(pos.lat().toFixed(6), pos.lng().toFixed(6));
          });
        }

        setMapReady(true);
        setMapError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setMapError("تعذر تحميل خريطة Google — تحقق من مفتاح API والاتصال.");
        }
      });

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!mapReady || !map || !marker) return;

    if (!hasPin) {
      marker.setMap(null);
      return;
    }

    const position = { lat: lat!, lng: lng! };
    marker.setMap(map);
    marker.setPosition(position);
    map.panTo(position);
    if (map.getZoom()! < PIN_ZOOM) map.setZoom(PIN_ZOOM);
  }, [mapReady, hasPin, lat, lng]);

  if (mapError) {
    return (
      <div className="rounded-[var(--radius-DEFAULT)] border border-dashed border-border-md bg-surface-2 px-4 py-6 text-center text-xs text-text-3">
        <p className="m-0 mb-2.5">{mapError}</p>
        {hasPin ? (
          <a
            href={googleMapsSearchUrl(lat!, lng!)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary no-underline hover:underline"
          >
            فتح الموقع في Google Maps ({latitude}, {longitude})
          </a>
        ) : (
          <span>أدخل الإحداثيات أو اضغط على الخريطة</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2">
      <div ref={containerRef} className="h-[280px] w-full" aria-label="خريطة Google" />
      {!mapReady ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 p-6">
          <Skeleton className="h-full w-full max-h-[200px]" />
        </div>
      ) : null}
      {!hasPin && mapReady ? (
        <p className="m-0 border-t border-border bg-surface px-3 py-2 text-[11px] text-text-3">
          اضغط على الخريطة لتحديد موقع العقار، أو أدخل الإحداثيات يدوياً.
        </p>
      ) : null}
    </div>
  );
}
