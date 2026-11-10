"use client";

import { useState } from "react";
import { AppModal } from "@platform/ui-kit";
import {
  propertyOwnerNames,
  type PoPropertyIntake,
} from "@platform/app-shared/app-data/po-intake-property-model";

/**
 * «اسم المالك» in the property header: «مشاع» when the staff ticked it, else the owner's name; an ⓘ
 * lists the names when there are several (a long list used to run off the header).
 *
 * How it works: the «مشاع» tick decides (Omar 2026-11-10 — the owners count no longer does); a deed
 * not ticked with several names shows their count with the same ⓘ.
 * Edge cases: no owner and no tick renders nothing, so the caller hides the cell; a ticked deed with
 * no names yet shows «مشاع» alone.
 */
export function PropertyOwnerValue({
  property,
}: {
  property: Pick<PoPropertyIntake, "ownerName" | "isSharedOwnership">;
}) {
  const [open, setOpen] = useState(false);
  const names = propertyOwnerNames(property);
  const shared = property.isSharedOwnership === true;
  if (!shared && names.length === 0) return null;
  if (!shared && names.length === 1) return <>{names[0]}</>;
  if (names.length === 0) return <>مشاع</>;

  return (
    <>
      <span className="inline-flex items-center gap-1">
        {shared ? "مشاع" : `${names.length} ملاك`}
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
