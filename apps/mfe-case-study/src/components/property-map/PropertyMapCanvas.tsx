"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerKey, MapCoords } from "../../lib/app-data/map-locations-logic";
import { escapeHtml } from "@platform/app-shared/lib/html-escape";

export type PropertyMapMarker = {
  id: string;
  coords: MapCoords;
  layer: LayerKey;
  pulse?: boolean;
  count?: number;
  infeasible?: boolean;
  archived?: boolean;
  approved?: boolean;
  title?: string;
  subtitle?: string;
};

export type MapViewCommand =
  | { seq: number; type: "home" }
  | { seq: number; type: "fit" }
  | { seq: number; type: "fly"; coords: MapCoords; zoom?: number };

export type MapBasemap = "carto" | "osm" | "satellite";

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

export const SAUDI_CENTER: [number, number] = [24.2, 45.0];
export const SAUDI_ZOOM = 6;

const TILES: Record<MapBasemap, { url: string; attrib: string; subdomains?: string }> = {
  carto: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attrib:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attrib:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abc",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attrib: "Esri, Maxar",
  },
};

const CLUSTER_COLORS: Record<LayerKey, { bg: string; ring: string; fg: string }> = {
  active: { bg: "#12284C", ring: "rgba(164,144,111,.5)", fg: "#c8b591" },
  archive: { bg: "#8a8d96", ring: "rgba(138,141,150,.35)", fg: "#fff" },
  comparables: { bg: "#a4906f", ring: "rgba(164,144,111,.35)", fg: "#fff" },
};

type LeafletNS = typeof import("leaflet") & {
  markerClusterGroup?: (options?: Record<string, unknown>) => import("leaflet").LayerGroup;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function markerHtml(
  m: PropertyMapMarker,
  selected: boolean,
  opts: { dropDelayMs?: number; reduceMotion: boolean },
): string {
  const archived = !!m.archived || m.layer === "archive";
  const size = archived ? 14 : m.layer === "comparables" ? 11 : 18;
  const haloColor = m.infeasible ? "#d9694f" : "#a4906f";
  const pulseStyle = opts.reduceMotion
    ? "opacity:.55;"
    : "animation:ejada-map-pulse 1.7s ease-out infinite;";
  const halo =
    m.pulse && !archived
      ? `<span class="ejada-map-halo" style="position:absolute;inset:-6px;border-radius:50%;border:3px solid ${haloColor};${pulseStyle}"></span>`
      : "";
  const drop =
    opts.dropDelayMs != null && !opts.reduceMotion
      ? `animation:ejada-map-drop .55s cubic-bezier(.2,1.4,.5,1) both;animation-delay:${opts.dropDelayMs}ms;`
      : "";
  const ring = selected
    ? "box-shadow:0 0 0 3px #fff,0 0 0 6px #c8b591,0 2px 8px rgba(18,40,76,.4);"
    : "";
  let body: string;
  if (m.layer === "comparables") {
    const fill = m.approved ? "#a4906f" : "#fff";
    const border = m.approved ? "#fff" : "#a4906f";
    body = `<span style="position:absolute;inset:0;width:11px;height:11px;transform:rotate(45deg);background:${fill};border:2px solid ${border};border-radius:2px;box-shadow:0 2px 6px rgba(140,120,87,.5);${ring}"></span>`;
  } else if (m.infeasible) {
    const bg = archived ? "#8a8d96" : "#d9694f";
    body = `<span style="position:absolute;inset:-2px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 2px 8px rgba(18,40,76,.45);display:grid;place-items:center;${ring}"><svg width="${size - 6}" height="${size - 6}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><path d="M12 9v4M12 17h.01"></path></svg></span>`;
  } else {
    const bg = archived ? "#8a8d96" : "#12284C";
    body = `<span style="position:absolute;inset:0;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 2px 8px rgba(18,40,76,.45);${ring}"></span>`;
  }
  const badge =
    m.count && m.count > 1
      ? `<span style="position:absolute;top:-6px;right:-6px;min-width:13px;height:13px;padding:0 2px;border-radius:99px;background:#a4906f;color:#fff;font:700 9px Tajawal,sans-serif;display:grid;place-items:center;border:1.5px solid #fff">${m.count}</span>`
      : "";
  return `<div style="position:relative;width:${size}px;height:${size}px;${drop}">${halo}${body}${badge}</div>`;
}

function clusterIconHtml(kind: LayerKey, count: number): string {
  const colors = CLUSTER_COLORS[kind];
  const size = count < 10 ? 30 : count < 100 ? 36 : 44;
  const shape =
    kind === "comparables"
      ? "border-radius:8px;transform:rotate(45deg)"
      : "border-radius:50%";
  const inner = kind === "comparables" ? "transform:rotate(-45deg);" : "";
  return `<div style="width:${size}px;height:${size}px;${shape};background:${colors.bg};box-shadow:0 0 0 5px ${colors.ring},0 2px 10px rgba(18,40,76,.4);display:grid;place-items:center"><span style="${inner}color:${colors.fg};font:700 ${count < 100 ? 12 : 11}px Tajawal,sans-serif">${count.toLocaleString("en-US")}</span></div>`;
}

// HTML escape via the shared helper in app-shared.

function leafletNs(mod: typeof import("leaflet")): LeafletNS {
  const withDefault = mod as typeof import("leaflet") & {
    default?: typeof import("leaflet");
  };
  const candidate = withDefault.default ?? mod;
  return (typeof candidate.map === "function" ? candidate : mod) as LeafletNS;
}

function pinSize(m: PropertyMapMarker, selected: boolean): [number, number] {
  const base = m.archived || m.layer === "archive" ? 14 : m.layer === "comparables" ? 11 : 18;
  const s = selected ? base + 8 : base;
  return [s, s];
}

function makeClusterGroup(L: LeafletNS, kind: LayerKey): import("leaflet").LayerGroup {
  if (typeof L.markerClusterGroup !== "function") return L.layerGroup();
  return L.markerClusterGroup({
    maxClusterRadius: 55,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
    iconCreateFunction: (cluster: { getChildCount: () => number }) => {
      const n = cluster.getChildCount();
      const size = n < 10 ? 30 : n < 100 ? 36 : 44;
      return L.divIcon({
        html: clusterIconHtml(kind, n),
        className: "ejada-map-cluster",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    },
  });
}

export function PropertyMapCanvas({
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
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const groupsRef = useRef<Partial<Record<LayerKey, import("leaflet").LayerGroup>>>({});
  const tilesRef = useRef<import("leaflet").TileLayer | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const markersRef = useRef(markers);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const lastCommandSeq = useRef(0);
  const introPlayed = useRef(false);

  markersRef.current = markers;
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  onBackgroundClickRef.current = onBackgroundClick;

  const paint = () => {
    const L = LRef.current;
    const current = mapRef.current;
    const groups = groupsRef.current;
    if (!L || !current) return;
    const selected = selectedRef.current;
    const reduceMotion = prefersReducedMotion();
    const intro = !introPlayed.current && !reduceMotion;
    let dropI = 0;
    const counts: Record<LayerKey, number> = {
      active: 0,
      archive: 0,
      comparables: 0,
    };

    (["active", "archive", "comparables"] as LayerKey[]).forEach((key) => {
      groups[key]?.clearLayers();
    });

    for (const m of markersRef.current) {
      const group = groups[m.layer];
      if (!group) continue;
      counts[m.layer] += 1;
      const isSel = m.id === selected;
      const size = pinSize(m, isSel);
      const dropDelayMs = intro ? Math.min(dropI++ * 60, 900) : undefined;
      const icon = L.divIcon({
        className: "ejada-map-pin",
        html: markerHtml(m, isSel, { dropDelayMs, reduceMotion }),
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1] / 2],
      });
      const marker = L.marker([m.coords.lat, m.coords.lng], {
        icon,
        zIndexOffset: isSel ? 600 : 0,
      });
      marker.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelectRef.current(m.id);
      });
      if (m.title) {
        const title = escapeHtml(m.title);
        const subtitle = m.subtitle ? escapeHtml(m.subtitle) : "";
        marker.bindTooltip(
          `<b>${title}</b>${subtitle ? `<br><span style="opacity:.75">${subtitle}</span>` : ""}`,
          { className: "ejada-map-tip", direction: "top", offset: [0, -10], sticky: false },
        );
      }
      marker.addTo(group);
    }

    (["active", "archive", "comparables"] as LayerKey[]).forEach((key) => {
      const group = groups[key];
      if (!group) return;
      const on = counts[key] > 0;
      if (on && !current.hasLayer(group)) group.addTo(current);
      if (!on && current.hasLayer(group)) current.removeLayer(group);
    });

    introPlayed.current = true;
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];

    void (async () => {
      const L = leafletNs(await import("leaflet"));
      const globalL = globalThis as typeof globalThis & { L?: LeafletNS };
      if (!globalL.L) globalL.L = L;
      await import("leaflet.markercluster");
      if (cancelled || !hostRef.current) return;
      LRef.current = L;

      map = L.map(host, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 5,
        maxZoom: 18,
      }).setView(SAUDI_CENTER, SAUDI_ZOOM);
      map.zoomControl.setPosition("topright");
      map.on("click", () => onBackgroundClickRef.current());

      const spec = TILES.carto;
      const tiles = L.tileLayer(spec.url, {
        attribution: spec.attrib,
        subdomains: spec.subdomains,
        maxZoom: 18,
      }).addTo(map);
      tilesRef.current = tiles;

      groupsRef.current = {
        active: makeClusterGroup(L, "active"),
        archive: makeClusterGroup(L, "archive"),
        comparables: makeClusterGroup(L, "comparables"),
      };
      mapRef.current = map;

      paint();
      const invalidate = () => map?.invalidateSize();
      requestAnimationFrame(invalidate);
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(invalidate);
        ro.observe(host);
      }
      timers.push(window.setTimeout(invalidate, 80), window.setTimeout(invalidate, 320));
    })();

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      groupsRef.current = {};
      tilesRef.current = null;
      LRef.current = null;
    };
  }, []);

  useEffect(() => {
    paint();
  }, [markers, selectedId]);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    tilesRef.current?.remove();
    const spec = TILES[basemap];
    tilesRef.current = L.tileLayer(spec.url, {
      attribution: spec.attrib,
      subdomains: spec.subdomains,
      maxZoom: 18,
    }).addTo(map);
  }, [basemap]);

  useEffect(() => {
    if (!command || command.seq === lastCommandSeq.current) return;
    lastCommandSeq.current = command.seq;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (command.type === "home") {
      map.setView(SAUDI_CENTER, SAUDI_ZOOM);
      return;
    }
    if (command.type === "fly") {
      const z = command.zoom ?? Math.max(map.getZoom(), 15);
      map.flyTo([command.coords.lat, command.coords.lng], z, { duration: 0.8 });
      return;
    }
    const withCoords = markersRef.current;
    if (withCoords.length === 0) {
      map.setView(SAUDI_CENTER, SAUDI_ZOOM);
      return;
    }
    const bounds = L.latLngBounds(
      withCoords.map((m) => [m.coords.lat, m.coords.lng] as [number, number]),
    );
    map.fitBounds(bounds.pad(0.18), { maxZoom: 12, animate: true, padding: [60, 60] });
  }, [command]);

  return (
    <div
      className="relative h-full min-h-0 min-w-0 w-full flex-1 [&_.leaflet-cluster-anim_.leaflet-marker-icon]:[transition:transform_0.3s_ease-out,opacity_0.3s_ease-in] [&_.leaflet-cluster-anim_.leaflet-marker-shadow]:[transition:transform_0.3s_ease-out,opacity_0.3s_ease-in] [&_.leaflet-cluster-spider-leg]:stroke-[#12284C] [&_.leaflet-cluster-spider-leg]:[stroke-opacity:0.45] [&_.leaflet-cluster-spider-leg]:[transition:stroke-dashoffset_0.3s_ease-out,stroke-opacity_0.3s_ease-in]"
    >
      <style>{`
        @keyframes ejada-map-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 43, 78, 0.45); opacity: 1; }
          70% { box-shadow: 0 0 0 12px rgba(16, 43, 78, 0); opacity: 0; }
          100% { box-shadow: 0 0 0 0 rgba(16, 43, 78, 0); opacity: 0; }
        }
        @keyframes ejada-map-drop {
          from { transform: translateY(-16px) scale(.55); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        .ejada-map-pin, .ejada-map-cluster { background: transparent; border: 0; }
        .leaflet-top .leaflet-control {
          opacity: .4;
          transition: opacity .2s;
        }
        .leaflet-top .leaflet-control:hover { opacity: 1; }
        .leaflet-control-zoom {
          border: 0 !important;
          margin: 12px 12px 0 0 !important;
          box-shadow: 0 1px 6px rgba(16,43,78,.18) !important;
        }
        .leaflet-control-zoom a {
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          color: #102b4e !important;
        }
        .leaflet-container { width: 100%; height: 100%; font-family: inherit; background: #e9e6df; }
        .leaflet-control-attribution { font-size: 10px; }
        .ejada-map-tip {
          background: #12284C;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 6px 10px;
          font: 600 12px Tajawal, sans-serif;
          box-shadow: 0 8px 20px -10px rgba(18,40,76,.5);
        }
        .ejada-map-tip::before { border-top-color: #12284C; }
        .ejada-map-chrome {
          opacity: .4;
          transition: opacity .2s;
        }
        .ejada-map-chrome:hover, .ejada-map-chrome:focus-within { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .ejada-map-halo, .leaflet-marker-pane div {
            animation: none !important;
            transform: none !important;
          }
          .ejada-map-halo { opacity: .55 !important; }
        }
      `}</style>
      <div ref={hostRef} className="absolute inset-0 h-full w-full" dir="ltr" />
      <div className="ejada-map-chrome pointer-events-none absolute right-3 top-[92px] z-[1000] flex flex-col gap-1.5">
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
    </div>
  );
}
