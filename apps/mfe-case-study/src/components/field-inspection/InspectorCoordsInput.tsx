"use client";

import { useState } from "react";
import { cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { parseCoordinatePair } from "@platform/app-shared/domain/geo";
import { shouldUseJeddahDefaultCoords } from "@platform/app-shared/domain/jeddah-default-coords";
import { INS_LABEL_CLASS } from "./FieldInspectionWorkParts";
import { useInsControlClass } from "../po-intake/PropertyDetailInspectionFields";

/**
 * The typed «lat, lng» box of the property location — the inspector's phone screen and the wizard.
 *
 * How it works: `value` is the saved pair; while the box is focused it shows the user's own text.
 * Only a complete, in-range pair inside the Kingdom reaches `onCoords`, as read by
 * `parseCoordinatePair`.
 *
 * Edge cases: a half-typed pair writes nothing — every keystroke used to patch the draft, which wiped
 * the box, and a blank save came back as the Jeddah default. A pair outside the Kingdom writes nothing
 * and says so (`onOutsideChange` lets the caller hold back «تثبيت الموقع»): it used to be saved, then
 * swapped for the Jeddah placeholder on reload.
 */
export function InspectorCoordsInput({
  value,
  invalid = false,
  className,
  onCoords,
  onOutsideChange,
}: {
  value: string;
  invalid?: boolean;
  className?: string;
  onCoords: (lat: string, lng: string) => void;
  onOutsideChange?: (outside: boolean) => void;
}) {
  // The work page's layout (`work` density) (Omar 2026-11-09): the page's one control height; unchanged elsewhere.
  const insCtl = useInsControlClass();
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const [outside, setOutside] = useState(false);

  const markOutside = (next: boolean) => {
    setOutside(next);
    onOutsideChange?.(next);
  };

  return (
    <div className={className}>
      <label htmlFor="ins-map-coords" className={INS_LABEL_CLASS}>
        الإحداثيات
      </label>
      <input
        id="ins-map-coords"
        className={cn(insCtl, "tabular-nums", (invalid || outside) && invalidControlClass)}
        dir="ltr"
        placeholder="21.523339, 39.187743"
        value={editing ? text : value}
        onFocus={() => {
          setText(value);
          setEditing(true);
        }}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          setText(e.target.value);
          const pair = parseCoordinatePair(e.target.value);
          if (!pair) {
            markOutside(false);
            return;
          }
          const isOutside = shouldUseJeddahDefaultCoords(String(pair.lat), String(pair.lng));
          markOutside(isOutside);
          if (!isOutside) onCoords(String(pair.lat), String(pair.lng));
        }}
      />
      {outside ? (
        <p className="mt-1 text-[11px] text-danger-text" role="alert">
          الإحداثيات خارج المملكة — تأكد من ترتيبها (خط العرض ثم خط الطول)
        </p>
      ) : null}
    </div>
  );
}
