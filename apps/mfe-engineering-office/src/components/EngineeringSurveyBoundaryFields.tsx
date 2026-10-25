"use client";

import { cn, opsFldControl, opsTfLbl } from "@platform/ui-kit";
import { engineeringInvalidControlClass } from "../lib/engineering-survey-validation";
import type { LocalTextFields } from "./EngineeringSurveyWorkParts";

type BoundaryRow = readonly [keyof LocalTextFields, keyof LocalTextFields, string, string];

/**
 * Total area plus the four boundary / length pairs — one block for the deed boundaries and
 * one for the nature boundaries (same layout, different fields and ids).
 */
export function EngBoundaryFields({
  areaId,
  areaKey,
  areaError,
  rows,
  localFields,
  patchLocalField,
  disabled,
}: {
  areaId: string;
  areaKey: "onSiteAreaSqm" | "natureOnSiteAreaSqm";
  areaError: string | undefined;
  rows: readonly BoundaryRow[];
  localFields: LocalTextFields;
  patchLocalField: <K extends keyof LocalTextFields>(key: K, value: LocalTextFields[K]) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={opsTfLbl} htmlFor={areaId}>
            المساحة الإجمالية
          </label>
          <input
            id={areaId}
            inputMode="decimal"
            className={cn(opsFldControl, areaError && engineeringInvalidControlClass)}
            disabled={disabled}
            value={localFields[areaKey]}
            onChange={(e) => patchLocalField(areaKey, e.target.value)}
          />
          {areaError ? <p className="mt-1 text-[11px] text-[#a5432e]">{areaError}</p> : null}
        </div>
      </div>

      {rows.map(([boundKey, lenKey, boundLabel, lenLabel]) => (
        <div key={boundKey} className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className={opsTfLbl} htmlFor={`eng-${boundKey}`}>
              {boundLabel}
            </label>
            <input
              id={`eng-${boundKey}`}
              className={opsFldControl}
              disabled={disabled}
              value={localFields[boundKey]}
              onChange={(e) => patchLocalField(boundKey, e.target.value)}
            />
          </div>
          <div>
            <label className={opsTfLbl} htmlFor={`eng-${lenKey}`}>
              {lenLabel}
            </label>
            <input
              id={`eng-${lenKey}`}
              inputMode="decimal"
              className={opsFldControl}
              disabled={disabled}
              value={localFields[lenKey]}
              onChange={(e) => patchLocalField(lenKey, e.target.value)}
            />
          </div>
        </div>
      ))}
    </>
  );
}
