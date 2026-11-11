"use client";

import {
  MapControlButton,
  MapControlGroup,
  MapControlStack,
  type MapControlIconName,
} from "@platform/ui-kit";
import type { MapBasemap } from "./property-map-shared";

const BASEMAPS: { id: MapBasemap; label: string; icon: MapControlIconName }[] = [
  { id: "carto", label: "فاتح", icon: "light" },
  { id: "osm", label: "شوارع", icon: "streets" },
  { id: "satellite", label: "قمر صناعي", icon: "satellite" },
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
    <MapControlStack className={className}>
      <MapControlButton label="إعادة توسيط الخريطة" icon="recenter" onClick={onRecenter} />
      <MapControlGroup>
        {BASEMAPS.map((b) => (
          <MapControlButton
            key={b.id}
            label={b.label}
            icon={b.icon}
            pressed={basemap === b.id}
            onClick={() => onBasemapChange(b.id)}
          />
        ))}
      </MapControlGroup>
    </MapControlStack>
  );
}
