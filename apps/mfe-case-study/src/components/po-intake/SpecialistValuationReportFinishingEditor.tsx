"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@platform/ui-kit";
import { rememberPropertyPoNumber } from "@platform/app-shared/storage/specialist-report-extras-sync";
import {
  ensureOrganizationSettingsLoaded,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import {
  SPECIALIST_FINISHING_LEVEL_OPTIONS,
  SPECIALIST_FINISHING_REQUIRED_MESSAGE,
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  specialistFinishingDescriptions,
  type SpecialistFinishingLevel,
} from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import { VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT } from "@platform/app-shared/events/app-events";

/**
 * «مستوى تشطيبات البناء» — the case specialist's pick, printed (highlighted) in the valuation report.
 *
 * How it works (Omar 2026-11-19: the dropdown was «trash»): the four levels are cards to pick from,
 * each with the description the report prints for it (from «إعدادات المنشأة»), so the specialist
 * picks by what a level means, not by its name; a pick saves at once, as the dropdown did.
 * Edge cases: read only, only the chosen level shows (or «لم يُحدَّد بعد»); «اختر مستوى…» on accept
 * without a pick marks the cards and scrolls to them.
 */
export function SpecialistValuationReportFinishingEditor({
  propertyId,
  poNumber,
  readOnly = false,
}: {
  propertyId: string;
  poNumber?: string;
  readOnly?: boolean;
}) {
  const radioName = useId();
  const [level, setLevel] = useState(() => loadSpecialistFinishingLevel(propertyId));
  const [invalid, setInvalid] = useState(false);
  const [descriptions, setDescriptions] = useState(() =>
    specialistFinishingDescriptions(getCachedOrganizationSettings()?.valuationReport),
  );

  // Another property means another saved level — read it before this paint.
  const [levelForProperty, setLevelForProperty] = useState(propertyId);
  if (levelForProperty !== propertyId) {
    setLevelForProperty(propertyId);
    setLevel(loadSpecialistFinishingLevel(propertyId));
    setInvalid(false);
  }

  useEffect(() => {
    let live = true;
    void ensureOrganizationSettingsLoaded().then((settings) => {
      if (live && settings) setDescriptions(specialistFinishingDescriptions(settings.valuationReport));
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const id = propertyId.trim();
    const po = (poNumber ?? "").trim();
    if (id && po) rememberPropertyPoNumber(id, po);
  }, [propertyId, poNumber]);

  useEffect(() => {
    const onRequired = (event: Event) => {
      const detail = (event as CustomEvent<{ propertyId?: string }>).detail;
      if (detail?.propertyId?.trim() !== propertyId.trim()) return;
      setInvalid(true);
      window.requestAnimationFrame(() => {
        document
          .getElementById("specialist-valuation-finishing")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    window.addEventListener(VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT, onRequired);
  }, [propertyId]);

  function choose(next: SpecialistFinishingLevel) {
    setLevel(next);
    setInvalid(false);
    saveSpecialistFinishingLevel(propertyId, next);
  }

  const shown = readOnly
    ? SPECIALIST_FINISHING_LEVEL_OPTIONS.filter((o) => o.value === level)
    : SPECIALIST_FINISHING_LEVEL_OPTIONS;

  return (
    <section id="specialist-valuation-finishing" className="mb-4">
      {shown.length === 0 ? (
        <p className="m-0 text-[12px] text-text-3">لم يُحدَّد مستوى التشطيب بعد.</p>
      ) : (
        <div
          role="radiogroup"
          aria-label="مستوى تشطيبات البناء"
          aria-required={!readOnly || undefined}
          aria-invalid={(invalid && !readOnly) || undefined}
          className={cn("grid gap-2", !readOnly && "sm:grid-cols-2 xl:grid-cols-4")}
        >
          {shown.map((opt) => {
            const on = level === opt.value;
            const description = descriptions[opt.value];
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-lg)] border px-3 py-2.5 transition-colors",
                  readOnly ? "cursor-default" : "cursor-pointer",
                  on
                    ? "border-heading bg-[color-mix(in_srgb,var(--heading)_7%,var(--surface))] shadow-[0_0_0_1px_var(--heading)]"
                    : "border-border-md bg-surface hover:border-heading",
                  invalid && !readOnly && !on && "border-danger",
                )}
              >
                <span className="flex items-center gap-2 text-[12.5px] font-bold text-heading">
                  <input
                    type="radio"
                    name={radioName}
                    className="size-4 shrink-0 accent-[var(--heading)]"
                    checked={on}
                    disabled={readOnly}
                    onChange={() => choose(opt.value)}
                  />
                  {opt.label}
                </span>
                {/* The whole text, as the report prints it (Omar 2026-11-19). */}
                <span className="whitespace-pre-line text-[11px] leading-relaxed text-text-3">
                  {description || "لا يُطبع له وصف."}
                </span>
              </label>
            );
          })}
        </div>
      )}
      {invalid && !readOnly ? (
        <p className="m-0 mt-2 text-[11.5px] font-semibold text-danger" role="alert">
          {SPECIALIST_FINISHING_REQUIRED_MESSAGE}
        </p>
      ) : null}
    </section>
  );
}
