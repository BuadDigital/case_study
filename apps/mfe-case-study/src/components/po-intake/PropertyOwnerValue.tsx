"use client";

import { useState } from "react";
import { AppModal } from "@platform/ui-kit";
import {
  propertyOwnerNames,
  type PoPropertyIntake,
} from "@platform/app-shared/app-data/po-intake-property-model";

/**
 * «اسم المالك» in the property header: one owner by name; several as «مشاع» with an ⓘ that lists them
 * (a long list used to run off the header).
 *
 * How it works: the count from `propertyOwnerNames` decides, the same rule as the ownership type —
 * there is no manual choice. Edge cases: no owner renders nothing, so the caller hides the cell.
 */
export function PropertyOwnerValue({
  property,
}: {
  property: Pick<PoPropertyIntake, "ownerName" | "ownersJson">;
}) {
  const [open, setOpen] = useState(false);
  const names = propertyOwnerNames(property);
  if (names.length === 0) return null;
  if (names.length === 1) return <>{names[0]}</>;

  return (
    <>
      <span className="inline-flex items-center gap-1">
        مشاع
        <button
          type="button"
          aria-label="أسماء الملاك"
          title="أسماء الملاك"
          onClick={() => setOpen(true)}
          className="grid size-[18px] cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 font-inherit text-[15px] leading-none text-primary-light hover:text-primary"
        >
          <i className="ti ti-info-circle" aria-hidden />
        </button>
      </span>
      <AppModal open={open} title={`الملاك (${names.length})`} onClose={() => setOpen(false)}>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 ps-5 text-[13px] text-text">
          {names.map((name, index) => (
            <li key={`${index}-${name}`}>{name}</li>
          ))}
        </ol>
      </AppModal>
    </>
  );
}
