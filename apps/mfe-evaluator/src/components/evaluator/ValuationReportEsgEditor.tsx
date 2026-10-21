"use client";

import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { MobileRecordCard, MobileRecordList, cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  ESG_NONE_NOTES,
  type SpecialistEsgGroup,
} from "@platform/app-shared/app-data/valuation-report-specialist-esg";

const thClass =
  "border-b border-border bg-surface-2 px-2.5 py-2 text-[11px] font-bold text-text-2";
const tdClass = "border-b border-border px-2.5 py-2.5 align-top text-[12.5px]";
const inputClass =
  "w-full rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-ink disabled:cursor-not-allowed disabled:opacity-60";

type EsgEditorRowProps = {
  label: string;
  group: SpecialistEsgGroup;
  noneNotes: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (next: SpecialistEsgGroup) => void;
};

/** «يوجد تأثير» checkbox — table cell, or a 44px labelled toggle on the phone card. */
function EsgImpactToggle({
  group,
  noneNotes,
  disabled = false,
  onChange,
  touch,
}: EsgEditorRowProps & { touch?: boolean }) {
  return (
    <label
      className={cn(
        "cursor-pointer items-center",
        touch
          ? "flex min-h-11 gap-2.5 rounded-[10px] border border-border-md bg-surface px-3 text-[13px] font-semibold text-text"
          : "mx-auto inline-flex justify-center",
      )}
    >
      <input
        type="checkbox"
        className={cn(
          "shrink-0 accent-[var(--ink)] disabled:cursor-not-allowed",
          touch ? "size-5" : "size-4",
        )}
        checked={!group.none}
        disabled={disabled}
        aria-label={touch ? undefined : "يوجد تأثير"}
        onChange={(e) => {
          if (e.target.checked) {
            onChange({
              none: false,
              selected: [],
              notes:
                group.notes.trim() === noneNotes || !group.notes.trim()
                  ? ""
                  : group.notes,
            });
          } else {
            onChange({
              none: true,
              selected: [],
              notes: noneNotes,
            });
          }
        }}
      />
      {touch ? "يوجد تأثير على القيمة" : null}
    </label>
  );
}

/** «وصف الأثر» textarea + its error — table cell and phone card. */
function EsgNotesField({
  group,
  noneNotes,
  disabled = false,
  invalid = false,
  onChange,
  touch,
}: EsgEditorRowProps & { touch?: boolean }) {
  const displayNotes = group.none
    ? group.notes.trim() || noneNotes
    : group.notes;
  return (
    <>
      <textarea
        aria-label={touch ? "وصف الأثر" : undefined}
        className={cn(
          inputClass,
          "min-h-[72px] resize-y",
          touch && "text-[16px]",
          group.none && "text-text-2",
          invalid && invalidControlClass,
        )}
        rows={3}
        disabled={disabled || group.none}
        readOnly={group.none}
        placeholder={
          group.none
            ? noneNotes
            : "وصف الأثر عند وجود تأثير على القيمة التقديرية"
        }
        value={displayNotes}
        onChange={(e) =>
          onChange({ none: false, selected: [], notes: e.target.value })
        }
      />
      {invalid ? (
        <p className="mt-1.5 mb-0 text-[11px] font-semibold text-danger-text">
          وصف الأثر إلزامي عند اختيار «يوجد تأثير»
        </p>
      ) : null}
    </>
  );
}

function EsgEditorRow(props: EsgEditorRowProps) {
  return (
    <tr>
      <td className={cn(tdClass, "text-start font-semibold text-text-2")}>
        {props.label}
      </td>
      <td className={cn(tdClass, "align-middle text-center")}>
        <EsgImpactToggle {...props} />
      </td>
      <td className={cn(tdClass, "text-start")}>
        <EsgNotesField {...props} />
      </td>
    </tr>
  );
}

/** Phone: one card per ESG group — toggle, then the description at full width. */
function EsgEditorCard(props: EsgEditorRowProps) {
  return (
    <MobileRecordCard
      title={props.label}
      tone={props.invalid ? "red" : undefined}
    >
      <div className="flex flex-col gap-2">
        <EsgImpactToggle {...props} touch />
        <EsgNotesField {...props} touch />
      </div>
    </MobileRecordCard>
  );
}

/** ESG block filled by the appraiser on final review — printed in the valuation report. */
export function ValuationReportEsgEditor({
  esgEnv,
  esgSoc,
  esgGov,
  disabled = false,
  invalidGroups,
  onPatch,
}: {
  esgEnv: SpecialistEsgGroup;
  esgSoc: SpecialistEsgGroup;
  esgGov: SpecialistEsgGroup;
  disabled?: boolean;
  invalidGroups?: ReadonlyArray<"env" | "soc" | "gov">;
  onPatch: (patch: {
    esgEnv?: SpecialistEsgGroup;
    esgSoc?: SpecialistEsgGroup;
    esgGov?: SpecialistEsgGroup;
  }) => void;
}) {
  const desktop = useViewportDesktop();
  const invalid = new Set(invalidGroups ?? []);
  const groups = [
    {
      key: "env",
      label: "التأثيرات البيئية",
      group: esgEnv,
      patch: (next: SpecialistEsgGroup) => onPatch({ esgEnv: next }),
    },
    {
      key: "soc",
      label: "التأثيرات الاجتماعية",
      group: esgSoc,
      patch: (next: SpecialistEsgGroup) => onPatch({ esgSoc: next }),
    },
    {
      key: "gov",
      label: "تأثيرات الحوكمة",
      group: esgGov,
      patch: (next: SpecialistEsgGroup) => onPatch({ esgGov: next }),
    },
  ] as const;
  return (
    <div id="val-esg">
      {/* Phones: a card per group instead of the 520px table scrolled sideways. */}
      {desktop !== true ? (
        <MobileRecordList className="lg:hidden">
          {groups.map((g) => (
            <EsgEditorCard
              key={g.key}
              label={g.label}
              group={g.group}
              noneNotes={ESG_NONE_NOTES[g.key]}
              disabled={disabled}
              invalid={invalid.has(g.key)}
              onChange={g.patch}
            />
          ))}
        </MobileRecordList>
      ) : null}
      {desktop !== false ? (
        <div className="overflow-x-auto max-lg:hidden">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr>
                <th className={cn(thClass, "w-[28%] text-start")}>المجموعة</th>
                <th className={cn(thClass, "w-[14%] text-center")}>
                  يوجد تأثير
                </th>
                <th className={cn(thClass, "text-start")}>وصف الأثر</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <EsgEditorRow
                  key={g.key}
                  label={g.label}
                  group={g.group}
                  noneNotes={ESG_NONE_NOTES[g.key]}
                  disabled={disabled}
                  invalid={invalid.has(g.key)}
                  onChange={g.patch}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
