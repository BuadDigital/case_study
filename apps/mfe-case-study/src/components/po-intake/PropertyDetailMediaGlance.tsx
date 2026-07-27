"use client";

import { cn } from "@platform/design-system";
import {
  approximatePropertyGeo,
  approximatePropertyMapSearchUrl,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";

function PhotoPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-2 text-text-3">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m4 17 5-5 4 4 3-2 4 4" />
      </svg>
      <span className="px-3 text-center text-[11px] leading-snug">
        الصورة الرئيسية المحددة من شاشة المعاين
      </span>
    </div>
  );
}

/**
 * Case Study.html basic-tab media strip: main photo (1fr) + map (3fr).
 */
export function PropertyDetailMediaGlance({
  property,
  primaryPhoto,
}: {
  property: PoPropertyIntake;
  primaryPhoto?: PropertyDetailDocumentEntry | null;
}) {
  const geo = approximatePropertyGeo(property);
  const googleUrl =
    property.locationMapUrl.trim() ||
    approximatePropertyMapSearchUrl(property) ||
    (geo
      ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
      : null);

  const osmEmbed = geo
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(geo.lng - 0.006).toFixed(5)}%2C${(geo.lat - 0.004).toFixed(5)}%2C${(geo.lng + 0.006).toFixed(5)}%2C${(geo.lat + 0.004).toFixed(5)}&layer=mapnik&marker=${geo.lat}%2C${geo.lng}`
    : null;

  const hasPhoto = Boolean(primaryPhoto?.dataUrl);

  return (
    <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <div className="min-w-0">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-1.5">
          <div className="truncate text-[11px] text-text-3">
            صورة العقار الرئيسية
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-[#8c7857]">
            من المعاين
          </span>
        </div>
        <button
          type="button"
          className={cn(
            "relative block h-[200px] w-full overflow-hidden rounded border border-border bg-surface-2 p-0",
            hasPhoto ? "cursor-pointer" : "cursor-default",
          )}
          disabled={!hasPhoto}
          onClick={() => {
            if (primaryPhoto) openPropertyDetailDocumentPreview(primaryPhoto);
          }}
          aria-label={
            hasPhoto ? "معاينة الصورة الرئيسية" : "لا توجد صورة رئيسية بعد"
          }
        >
          {hasPhoto && primaryPhoto?.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryPhoto.dataUrl}
              alt={primaryPhoto.name || "صورة العقار الرئيسية"}
              className="h-full w-full object-cover"
            />
          ) : (
            <PhotoPlaceholder />
          )}
        </button>
      </div>

      <div className="min-w-0">
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
          {osmEmbed ? (
            <iframe
              title="خريطة موقع العقار"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-full w-full border-0"
              src={osmEmbed}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-2 px-4 text-center text-[12px] text-text-3">
              أضف المدينة أو رابط الموقع لعرض الخريطة
            </div>
          )}
          {geo ? (
            <div className="absolute top-2 start-2 rounded bg-white/92 px-2 py-1 text-[10.5px] font-semibold text-ink [direction:ltr]">
              {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
