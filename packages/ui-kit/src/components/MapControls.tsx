import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * The map controls of the system (Omar 2026-11-11): small white icon buttons stacked on the map's
 * edge, as first drawn for the main property map — in place of Google's default controls.
 *
 * `MapControlStack` lays the controls out, `MapControlGroup` joins buttons that belong together
 * (zoom in / out, the base-map choices), `MapControlButton` is one button — alone, or inside a
 * group. A pressed button (the base map in use) is navy with a gold icon.
 */

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** The icons the map controls use, by what the button does. */
export type MapControlIconName =
  | "zoom-in"
  | "zoom-out"
  | "recenter"
  | "home"
  | "light"
  | "streets"
  | "satellite"
  | "fullscreen"
  | "exit-fullscreen";

const ICONS: Record<MapControlIconName, ReactNode> = {
  "zoom-in": <path d="M12 5v14M5 12h14" />,
  "zoom-out": <path d="M5 12h14" />,
  recenter: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  // A house — back to the property the map is about.
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  streets: (
    <>
      <path d="M4 22 9 2M15 2l5 20" />
      <path d="M12 6v2M12 12v2M12 18v2" />
    </>
  ),
  satellite: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  "exit-fullscreen": <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
};

export function MapControlIcon({ name, size = 15 }: { name: MapControlIconName; size?: number }) {
  return (
    <svg width={size} height={size} {...ICON_PROPS}>
      {ICONS[name]}
    </svg>
  );
}

/**
 * The column of controls over a map. The layer itself lets presses through to the map; only the
 * controls take them. The caller places it (`className`: the corner, the stacking order).
 */
export function MapControlStack({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div dir="ltr" className={cn("pointer-events-none flex flex-col gap-1.5", className)}>
      {children}
    </div>
  );
}

/** Buttons that belong together, joined in one frame with a hairline between them. */
export function MapControlGroup({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border-2 border-black/20 bg-white [&>button]:size-[30px] [&>button]:rounded-none [&>button]:border-0 [&>button]:border-t [&>button]:border-[#ece8df] [&>button]:shadow-none [&>button:first-child]:border-t-0">
      {children}
    </div>
  );
}

/**
 * One map control: an icon button with its name as tooltip and accessible name.
 *
 * `pressed` marks the choice in use (a base map) — leave it out for a plain action.
 */
export function MapControlButton({
  label,
  icon,
  pressed,
  onClick,
}: {
  label: string;
  icon: MapControlIconName;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "pointer-events-auto box-border grid size-[34px] cursor-pointer place-items-center rounded-[4px] border-2 border-black/20 p-0 shadow-sm",
        pressed
          ? "bg-[#12284C] text-[#c8b591]"
          : cn("bg-white hover:bg-[#f6f3ec]", pressed === false ? "text-[#3a3f4d]" : "text-[#12284C]"),
      )}
    >
      <MapControlIcon name={icon} size={pressed === undefined ? 16 : 15} />
    </button>
  );
}
