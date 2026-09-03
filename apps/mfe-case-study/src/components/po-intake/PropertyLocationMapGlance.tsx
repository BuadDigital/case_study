"use client";

import { useState } from "react";
import { cn, useToast, GoogleMapPin } from "@platform/ui-kit";
import {
  approximatePropertyGeo,
  approximatePropertyMapSearchUrl,
  formatGeoDec,
  formatGeoDms,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";

const goldSoft =
  "rounded border border-transparent bg-[color-mix(in_srgb,#f1ece2_45%,transparent)]";

function parseCoord(value: string | null | undefined): number | null {
  const n = Number.parseFloat((value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function resolvePropertyGlanceGeo(
  property?: Pick<PoPropertyIntake, "city" | "deedNumber"> | null,
  latitude?: string | null,
  longitude?: string | null,
): { lat: number; lng: number } | null {
  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  if (lat != null && lng != null) return { lat, lng };
  return property ? approximatePropertyGeo(property) : null;
}

/**
 * Approved-location Google map + Google link + copyable coords.
 * Same strip as property-detail media glance (map column).
 */
export function PropertyLocationMapGlance({
  property,
  latitude,
  longitude,
  showCoordinates = true,
}: {
  property?: Pick<
    PoPropertyIntake,
    "city" | "district" | "deedNumber" | "locationMapUrl"
  > | null;
  latitude?: string | null;
  longitude?: string | null;
  showCoordinates?: boolean;
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const geo = resolvePropertyGlanceGeo(property, latitude, longitude);
  const googleUrl =
    (property?.locationMapUrl ?? "").trim() ||
    (geo
      ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
      : null) ||
    (property ? approximatePropertyMapSearchUrl(property) : null);

  const dms = geo ? formatGeoDms(geo.lat, geo.lng) : "";
  const dec = geo ? formatGeoDec(geo.lat, geo.lng) : "";

  async function copyCoords() {
    if (!dec) return;
    try {
      await navigator.clipboard.writeText(dec);
      setCopied(true);
      showToast("تم نسخ الإحداثيات", "success");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("تعذّر نسخ الإحداثيات", "error");
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-1.5">
        <div className="truncate text-[11px] text-text-3">
          موقع العقار المعتمد
        </div>
        {googleUrl ? (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#8c7857] no-underline"
          >
            خرائط جوجل ↗
          </a>
        ) : null}
      </div>
      <div className="relative h-[200px] min-w-0 overflow-hidden rounded border border-border">
        {geo ? (
          <GoogleMapPin
            lat={geo.lat}
            lng={geo.lng}
            title="خريطة موقع العقار"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2 px-4 text-center text-[12px] text-text-3">
            أضف المدينة أو رابط الموقع لعرض الخريطة
          </div>
        )}
      </div>
      {showCoordinates && geo ? (
        <div
          className={cn(
            "mt-2 flex flex-1 flex-col justify-center px-3 py-2",
            goldSoft,
          )}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="mb-[3px] text-[10.5px] text-text-3">
                إحداثيات الموقع
              </div>
              <div
                className="text-start text-[12.5px] font-semibold text-text [direction:ltr] [unicode-bidi:isolate]"
                dir="ltr"
              >
                {dms}
              </div>
              <div
                className="mt-px text-start text-[11px] text-text-3 [direction:ltr] [unicode-bidi:isolate]"
                dir="ltr"
              >
                {dec}
              </div>
            </div>
            <button
              type="button"
              title="نسخ الإحداثيات"
              onClick={() => void copyCoords()}
              className="inline-flex shrink-0 items-center gap-[5px] rounded-md border border-border-md bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-[#8c7857]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copied ? "تم النسخ" : "نسخ"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
