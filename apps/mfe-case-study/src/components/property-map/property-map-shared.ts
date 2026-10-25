/**
 * Contract shared by both map canvases (Leaflet `PropertyMapCanvas`, Google
 * `PropertyMapCanvasGoogle`): marker shape, view commands, props and the
 * cluster palette — switching canvases stays one line in PropertyMapView.
 */
import type { LayerKey, MapCoords } from "../../lib/app-data/map-locations-logic";

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

export type PropertyMapCanvasProps = {
  markers: PropertyMapMarker[];
  selectedId: string | null;
  basemap: MapBasemap;
  command: MapViewCommand | null;
  onSelect: (id: string) => void;
  onBackgroundClick: () => void;
  onBasemapChange: (basemap: MapBasemap) => void;
  onRecenter: () => void;
};

export const SAUDI_CENTER: [number, number] = [24.2, 45.0];
export const SAUDI_ZOOM = 6;

export const CLUSTER_COLORS: Record<LayerKey, { bg: string; ring: string; fg: string }> = {
  active: { bg: "#12284C", ring: "rgba(164,144,111,.5)", fg: "#c8b591" },
  archive: { bg: "#8a8d96", ring: "rgba(138,141,150,.35)", fg: "#fff" },
  comparables: { bg: "#a4906f", ring: "rgba(164,144,111,.35)", fg: "#fff" },
  failures: { bg: "#d9694f", ring: "rgba(217,105,79,.35)", fg: "#fff" },
};
