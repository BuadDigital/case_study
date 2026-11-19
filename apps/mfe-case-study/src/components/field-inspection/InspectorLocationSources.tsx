"use client";

import { Button, haversineMeters, type LatLng } from "@platform/ui-kit";
import { mapPinsSameSpot } from "@platform/app-shared/app-data/inspector-workspace-data";
import { INSPECTOR_SOURCE_PIN_COLOR, OFFICE_SOURCE_PIN_COLOR } from "./inspector-wizard-state";

/** The approved pin is the map's own red marker. */
const APPROVED_PIN_COLOR = "#ea4335";

type Source = {
  key: string;
  name: string;
  color: string;
  pin: LatLng;
  /** Moves the approved pin here — absent where the specialist may not. */
  onMoveHere?: () => void;
};

function distanceText(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} م` : `${(meters / 1000).toFixed(1)} كم`;
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

/**
 * «مصادر الموقع» — the specialist's legend and choice under the map (Omar 2026-11-19: the staff could not
 * tell «اعتماد موقع المعاين» from «اعتماد موقع المكتب الهندسي»).
 *
 * How it works: one row per place — the approved pin (what is saved for the property), the inspector's
 * and the engineering office's — each with the colour of its pin on the map. A source that is elsewhere
 * says how far it is from the approved pin and offers «نقل الموقع المعتمد إلى هنا».
 * Edge cases: sources within MAP_PIN_SAME_SPOT_METERS of the approved pin are the same place — one line
 * says so and nothing is offered; with no approved pin yet, no distance is given.
 */
export function InspectorLocationSources({
  approved,
  inspector,
  office,
  editable,
  onMoveToInspector,
  onMoveToOffice,
}: {
  approved: LatLng | null;
  inspector: LatLng | null;
  office: LatLng | null;
  editable: boolean;
  onMoveToInspector?: () => void;
  onMoveToOffice?: () => void;
}) {
  const sources: Source[] = [
    ...(inspector
      ? [{ key: "inspector", name: "موقع المعاين", color: INSPECTOR_SOURCE_PIN_COLOR, pin: inspector, onMoveHere: onMoveToInspector }]
      : []),
    ...(office
      ? [{ key: "office", name: "موقع المكتب الهندسي", color: OFFICE_SOURCE_PIN_COLOR, pin: office, onMoveHere: onMoveToOffice }]
      : []),
  ];
  if (sources.length === 0) return null;

  const elsewhere = sources.filter((s) => !mapPinsSameSpot(approved, s.pin));
  if (approved && elsewhere.length === 0) {
    return (
      <p className="mt-2.5 mb-0 flex items-center gap-1.5 text-[11.5px] text-success-text" role="status">
        <i className="ti ti-circle-check text-sm" aria-hidden />
        {sources.length > 1
          ? "موقع المعاين وموقع المكتب الهندسي مطابقان للموقع المعتمد."
          : `${sources[0]!.name} مطابق للموقع المعتمد.`}
      </p>
    );
  }

  return (
    <div className="mt-2.5 rounded-lg border border-border">
      <p className="m-0 border-b border-border bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-text-2">
        مصادر الموقع
      </p>
      <ul className="m-0 grid list-none p-0 text-[12px]">
        <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2">
          <Dot color={APPROVED_PIN_COLOR} />
          <span className="font-semibold text-heading">الموقع المعتمد</span>
          <span className="text-text-3">{approved ? "— هذا ما يُحفظ للعقار" : "— لم يُحدَّد بعد"}</span>
        </li>
        {sources.map((s) => {
          const same = mapPinsSameSpot(approved, s.pin);
          return (
            <li key={s.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2 last:border-b-0">
              <Dot color={s.color} />
              <span className="font-semibold text-heading">{s.name}</span>
              {same ? (
                <span className="text-success-text">✓ مطابق للموقع المعتمد</span>
              ) : approved ? (
                <span className="text-text-2">يبعد {distanceText(haversineMeters(approved, s.pin))} عن الموقع المعتمد</span>
              ) : null}
              {!same && editable && s.onMoveHere ? (
                <Button type="button" size="sm" variant="outline" className="ms-auto" onClick={s.onMoveHere}>
                  نقل الموقع المعتمد إلى هنا
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
