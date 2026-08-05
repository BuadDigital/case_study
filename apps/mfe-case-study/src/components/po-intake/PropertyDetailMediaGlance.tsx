"use client";

import { useState } from "react";
import { cn, useToast } from "@platform/design-system";
import {
  approximatePropertyGeo,
  approximatePropertyMapSearchUrl,
  buildPropertyDescriptionLine,
  formatGeoDec,
  formatGeoDms,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";

const goldSoft =
  "rounded border border-transparent bg-[color-mix(in_srgb,#f1ece2_45%,transparent)]";

/**
 * Case Study.html basic-tab media strip: main photo + description | map + coords.
 */
export function PropertyDetailMediaGlance({
  property,
  primaryPhoto,
  inspectorDescription,
}: {
  property: PoPropertyIntake;
  primaryPhoto?: PropertyDetailDocumentEntry | null;
  inspectorDescription?: string;
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
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
  const description = buildPropertyDescriptionLine(
    property,
    inspectorDescription,
  );
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
    <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <div className="flex min-w-0 flex-col">
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
            <div className="flex h-full w-full items-center justify-center bg-surface-2 text-[11px] text-text-3">
              لا توجد صورة بعد
            </div>
          )}
        </button>
        <div className={cn("mt-2 flex-1 px-3 py-2", goldSoft)}>
          <div className="mb-[3px] text-[10.5px] text-text-3">وصف العقار</div>
          <p className="m-0 text-xs font-semibold leading-[1.7] text-pretty text-text">
            {description}
          </p>
        </div>
      </div>

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
        </div>
        {geo ? (
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
    </div>
  );
}
