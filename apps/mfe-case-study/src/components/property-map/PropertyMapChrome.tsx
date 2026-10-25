"use client";

import type { MapBasemap } from "./property-map-shared";

const BASEMAPS: { id: MapBasemap; label: string; icon: string }[] = [
  {
    id: "carto",
    label: "فاتح",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>',
  },
  {
    id: "osm",
    label: "شوارع",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22 9 2M15 2l5 20"></path><path d="M12 6v2M12 12v2M12 18v2"></path></svg>',
  },
  {
    id: "satellite",
    label: "قمر صناعي",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  },
];

/** Recenter button + basemap switcher floating over either map canvas. */
export function PropertyMapChrome({
  className,
  basemap,
  onBasemapChange,
  onRecenter,
}: {
  /** Outer layer classes — each canvas stacks it at its own z-index. */
  className: string;
  basemap: MapBasemap;
  onBasemapChange: (basemap: MapBasemap) => void;
  onRecenter: () => void;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        title="إعادة توسيط الخريطة"
        aria-label="إعادة توسيط الخريطة"
        onClick={onRecenter}
        className="pointer-events-auto grid size-[34px] place-items-center rounded-[4px] border-2 border-black/20 bg-white text-[#12284C] shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border-2 border-black/20 bg-white">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.label}
            aria-label={b.label}
            aria-pressed={basemap === b.id}
            onClick={() => onBasemapChange(b.id)}
            className="grid size-[30px] place-items-center border-t border-[#ece8df] first:border-t-0"
            style={{
              background: basemap === b.id ? "#12284C" : "#fff",
              color: basemap === b.id ? "#c8b591" : "#3a3f4d",
            }}
            dangerouslySetInnerHTML={{ __html: b.icon }}
          />
        ))}
      </div>
    </div>
  );
}
