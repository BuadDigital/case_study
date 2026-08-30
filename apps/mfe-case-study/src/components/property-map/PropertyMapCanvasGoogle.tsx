"use client";

import { useEffect, useRef } from "react";
import { MarkerClusterer, type Renderer } from "@googlemaps/markerclusterer";
import { loadGoogleMapsApi } from "@platform/ui-kit";
import type { LayerKey } from "../../lib/prototype/map-locations-logic";
import type {
  MapBasemap,
  MapViewCommand,
  PropertyMapMarker,
} from "./PropertyMapCanvas";

/**
 * بديل Google لقماش الخريطة (كان Leaflet). العقد نفسه: نفس الـ props ونفس
 * أنواع العلامات، فالتبديل سطرٌ واحد في PropertyMapView. الدبابيس تُرسم أيقونات
 * SVG بدل HTML لأن العلامات الكلاسيكية لا تقبل عنصراً — ما يسقط نبض الهالة
 * وسقوط الدبوس فقط، وتبقى كل دلالات اللون والشكل والشارة.
 */

export const SAUDI_CENTER: [number, number] = [24.2, 45.0];
export const SAUDI_ZOOM = 6;

const CLUSTER_COLORS: Record<LayerKey, { bg: string; ring: string; fg: string }> = {
  active: { bg: "#12284C", ring: "rgba(164,144,111,.5)", fg: "#c8b591" },
  archive: { bg: "#8a8d96", ring: "rgba(138,141,150,.35)", fg: "#fff" },
  comparables: { bg: "#a4906f", ring: "rgba(164,144,111,.35)", fg: "#fff" },
};

/** أنماط Google المقابلة لأزرار الخلفية الثلاثة القائمة. */
const MAP_TYPE: Record<MapBasemap, string> = {
  carto: "roadmap",
  osm: "roadmap",
  satellite: "hybrid",
};

/** «فاتح» يبقى مميّزاً عن «شوارع» بتخفيت العناصر الثانوية. */
const LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
];

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** بطاقة العدّ أعلى الدبوس — كانت شارة HTML. */
function badgeSvg(count: number, x: number): string {
  const text = count.toLocaleString("en-US");
  const w = Math.max(13, 7 + text.length * 5);
  return `<g><rect x="${x - w}" y="0" width="${w}" height="13" rx="6.5" fill="#a4906f" stroke="#fff" stroke-width="1.5"/><text x="${x - w / 2}" y="9.5" text-anchor="middle" font-family="Tajawal,sans-serif" font-size="9" font-weight="700" fill="#fff">${text}</text></g>`;
}

/** أيقونة الدبوس بنفس دلالات نسخة Leaflet (طبقة/محدَّد/متعذّر/مؤرشف/معتمد). */
function pinIcon(
  g: typeof google,
  m: PropertyMapMarker,
  selected: boolean,
): google.maps.Icon {
  const archived = !!m.archived || m.layer === "archive";
  const base = archived ? 14 : m.layer === "comparables" ? 11 : 18;
  const size = selected ? base + 8 : base;
  const pad = 8; // متسع للحلقة والشارة
  const box = size + pad * 2;
  const c = box / 2;
  const r = size / 2;
  const ring = selected
    ? `<circle cx="${c}" cy="${c}" r="${r + 3}" fill="none" stroke="#fff" stroke-width="3"/><circle cx="${c}" cy="${c}" r="${r + 5}" fill="none" stroke="#c8b591" stroke-width="2.5"/>`
    : "";

  let body: string;
  if (m.layer === "comparables") {
    const fill = m.approved ? "#a4906f" : "#fff";
    const border = m.approved ? "#fff" : "#a4906f";
    const h = size / 1.6;
    body = `<rect x="${c - h}" y="${c - h}" width="${h * 2}" height="${h * 2}" rx="2" fill="${fill}" stroke="${border}" stroke-width="2" transform="rotate(45 ${c} ${c})"/>`;
  } else if (m.infeasible) {
    const bg = archived ? "#8a8d96" : "#d9694f";
    const s = size * 0.42;
    body = `<circle cx="${c}" cy="${c}" r="${r + 1}" fill="${bg}" stroke="#fff" stroke-width="2"/><path d="M${c} ${c - s} L${c + s} ${c + s * 0.8} L${c - s} ${c + s * 0.8} Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M${c} ${c - s * 0.1} v${s * 0.5}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
  } else {
    const bg = archived ? "#8a8d96" : "#12284C";
    body = `<circle cx="${c}" cy="${c}" r="${r}" fill="${bg}" stroke="#fff" stroke-width="2"/>`;
  }

  const halo =
    m.pulse && !archived
      ? `<circle cx="${c}" cy="${c}" r="${r + 4}" fill="none" stroke="${m.infeasible ? "#d9694f" : "#a4906f"}" stroke-width="3" opacity=".55"/>`
      : "";
  const badge = m.count && m.count > 1 ? badgeSvg(m.count, box) : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">${halo}${ring}${body}${badge}</svg>`;
  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(box, box),
    anchor: new g.maps.Point(c, c),
  };
}

/** فقاعات العناقيد بنفس ألوان وأحجام نسخة Leaflet. */
function clusterRenderer(g: typeof google, kind: LayerKey): Renderer {
  const colors = CLUSTER_COLORS[kind];
  return {
    render: ({ count, position }) => {
      const size = count < 10 ? 30 : count < 100 ? 36 : 44;
      const box = size + 12;
      const c = box / 2;
      const shape =
        kind === "comparables"
          ? `<rect x="${c - size / 2}" y="${c - size / 2}" width="${size}" height="${size}" rx="8" fill="${colors.bg}" transform="rotate(45 ${c} ${c})"/>`
          : `<circle cx="${c}" cy="${c}" r="${size / 2}" fill="${colors.bg}"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}"><circle cx="${c}" cy="${c}" r="${size / 2 + 4}" fill="${colors.ring}"/>${shape}<text x="${c}" y="${c + (count < 100 ? 4 : 4)}" text-anchor="middle" font-family="Tajawal,sans-serif" font-size="${count < 100 ? 12 : 11}" font-weight="700" fill="${colors.fg}">${count.toLocaleString("en-US")}</text></svg>`;
      return new g.maps.Marker({
        position,
        icon: {
          url: svgUrl(svg),
          scaledSize: new g.maps.Size(box, box),
          anchor: new g.maps.Point(c, c),
        },
        zIndex: 1000 + count,
      });
    },
  };
}

const LAYERS: LayerKey[] = ["active", "archive", "comparables"];

export function PropertyMapCanvasGoogle({
  markers,
  selectedId,
  basemap,
  command,
  onSelect,
  onBackgroundClick,
  onBasemapChange,
  onRecenter,
}: {
  markers: PropertyMapMarker[];
  selectedId: string | null;
  basemap: MapBasemap;
  command: MapViewCommand | null;
  onSelect: (id: string) => void;
  onBackgroundClick: () => void;
  onBasemapChange: (basemap: MapBasemap) => void;
  onRecenter: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef<typeof google | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clusterersRef = useRef<Partial<Record<LayerKey, MarkerClusterer>>>({});
  const markerObjsRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const readyRef = useRef(false);
  const failedRef = useRef(false);

  const markersRef = useRef(markers);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const lastCommandSeq = useRef(0);

  markersRef.current = markers;
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  onBackgroundClickRef.current = onBackgroundClick;

  const paint = () => {
    const g = gRef.current;
    const map = mapRef.current;
    if (!g || !map) return;

    for (const marker of markerObjsRef.current) marker.setMap(null);
    markerObjsRef.current = [];
    for (const key of LAYERS) clusterersRef.current[key]?.clearMarkers();

    const byLayer: Record<LayerKey, google.maps.Marker[]> = {
      active: [],
      archive: [],
      comparables: [],
    };
    const selected = selectedRef.current;

    for (const m of markersRef.current) {
      const isSel = m.id === selected;
      const marker = new g.maps.Marker({
        position: { lat: m.coords.lat, lng: m.coords.lng },
        icon: pinIcon(g, m, isSel),
        zIndex: isSel ? 600 : undefined,
        title: m.title ? [m.title, m.subtitle].filter(Boolean).join(" — ") : undefined,
      });
      marker.addListener("click", () => onSelectRef.current(m.id));
      if (m.title) {
        marker.addListener("mouseover", () => {
          const info = infoRef.current;
          if (!info) return;
          info.setContent(
            `<div style="font:600 12px Tajawal,sans-serif;color:#12284C">${escapeText(m.title ?? "")}${
              m.subtitle
                ? `<div style="opacity:.75;font-weight:500;margin-top:2px">${escapeText(m.subtitle)}</div>`
                : ""
            }</div>`,
          );
          info.open({ map, anchor: marker });
        });
        marker.addListener("mouseout", () => infoRef.current?.close());
      }
      byLayer[m.layer].push(marker);
      markerObjsRef.current.push(marker);
    }

    for (const key of LAYERS) {
      clusterersRef.current[key]?.addMarkers(byLayer[key]);
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    void loadGoogleMapsApi()
      .then((g) => {
        if (cancelled || !hostRef.current) return;
        gRef.current = g;
        const map = new g.maps.Map(host, {
          center: { lat: SAUDI_CENTER[0], lng: SAUDI_CENTER[1] },
          zoom: SAUDI_ZOOM,
          minZoom: 5,
          maxZoom: 20,
          mapTypeId: MAP_TYPE[basemap],
          styles: basemap === "carto" ? LIGHT_STYLE : undefined,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_TOP },
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        map.addListener("click", () => onBackgroundClickRef.current());
        mapRef.current = map;
        infoRef.current = new g.maps.InfoWindow({ disableAutoPan: true });

        for (const key of LAYERS) {
          clusterersRef.current[key] = new MarkerClusterer({
            map,
            markers: [],
            renderer: clusterRenderer(g, key),
          });
        }

        readyRef.current = true;
        paint();

        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(() => {
            const m = mapRef.current;
            if (m) g.maps.event.trigger(m, "resize");
          });
          ro.observe(host);
        }
      })
      .catch(() => {
        failedRef.current = true;
        if (!cancelled && hostRef.current) {
          hostRef.current.textContent =
            "تعذر تحميل خريطة Google — تحقق من مفتاح API وإعادة تشغيل الواجهة.";
        }
      });

    return () => {
      cancelled = true;
      ro?.disconnect();
      for (const key of LAYERS) clusterersRef.current[key]?.clearMarkers();
      clusterersRef.current = {};
      for (const marker of markerObjsRef.current) marker.setMap(null);
      markerObjsRef.current = [];
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
      gRef.current = null;
      readyRef.current = false;
    };
    // القماش يُركَّب مرة واحدة؛ الخلفية والأوامر تُعالَج في تأثيرات مستقلة.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (readyRef.current) paint();
  }, [markers, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(MAP_TYPE[basemap]);
    map.setOptions({ styles: basemap === "carto" ? LIGHT_STYLE : undefined });
  }, [basemap]);

  useEffect(() => {
    if (!command || command.seq === lastCommandSeq.current) return;
    lastCommandSeq.current = command.seq;
    const g = gRef.current;
    const map = mapRef.current;
    if (!g || !map) return;

    if (command.type === "home") {
      map.setCenter({ lat: SAUDI_CENTER[0], lng: SAUDI_CENTER[1] });
      map.setZoom(SAUDI_ZOOM);
      return;
    }
    if (command.type === "fly") {
      map.panTo({ lat: command.coords.lat, lng: command.coords.lng });
      map.setZoom(command.zoom ?? Math.max(map.getZoom() ?? SAUDI_ZOOM, 15));
      return;
    }
    const pts = markersRef.current;
    if (pts.length === 0) {
      map.setCenter({ lat: SAUDI_CENTER[0], lng: SAUDI_CENTER[1] });
      map.setZoom(SAUDI_ZOOM);
      return;
    }
    const bounds = new g.maps.LatLngBounds();
    for (const m of pts) bounds.extend({ lat: m.coords.lat, lng: m.coords.lng });
    map.fitBounds(bounds, 60);
    const z = map.getZoom();
    if (z != null && z > 12) map.setZoom(12);
  }, [command]);

  return (
    <div className="relative h-full min-h-0 min-w-0 w-full flex-1">
      <div
        ref={hostRef}
        className="absolute inset-0 h-full w-full bg-[#e9e6df] text-center text-[12px] text-[#6b7c8a]"
        dir="ltr"
      />
      <div className="ejada-map-chrome pointer-events-none absolute right-3 top-[92px] z-[5] flex flex-col gap-1.5 opacity-40 transition-opacity hover:opacity-100 focus-within:opacity-100">
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
          {BASEMAP_BUTTONS.map((b) => (
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
    </div>
  );
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASEMAP_BUTTONS: { id: MapBasemap; label: string; icon: string }[] = [
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
