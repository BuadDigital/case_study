"use client";

import { useMemo } from "react";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { initialsFromDisplayName } from "@platform/app-shared/lib/display-name-initials";
import { Card, Note, cn, useWorkDensity } from "@platform/ui-kit";
import { getEngineeringOffices, getFieldInspectors, getValuators } from "../../lib/app-data/distribution-parties";
import { buildAssigneeOpenLoadMap } from "../../lib/app-data/distribution-load";
import { assigneeLoadOptions } from "../../lib/app-data/distribution-assignee-options";
import type { TaskDistributionDraft } from "../../lib/app-data/tasks";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

function PartyBlock({
  enabled,
  title,
  onEnabledChange,
  readOnly,
  required,
  hint,
  children,
}: {
  enabled: boolean;
  title: string;
  onEnabledChange: (checked: boolean) => void;
  readOnly?: boolean;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden shadow-none transition-[border-color,box-shadow]",
        enabled &&
          "border-primary/45 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]",
      )}
    >
      {required ? (
        <div className="m-0 flex items-start gap-3 px-3.5 pb-2.5 pt-3.5">
          <p className="m-0 text-[13px] font-bold leading-snug text-text">{title}</p>
        </div>
      ) : (
        <label className="m-0 flex cursor-pointer items-start gap-3 px-3.5 pb-2.5 pt-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary"
            checked={enabled}
            disabled={readOnly}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <p className="m-0 text-[13px] font-bold leading-snug text-text">{title}</p>
        </label>
      )}
      {hint ? (
        <p className="m-0 px-3.5 pb-2 text-[11px] leading-relaxed text-text-3">{hint}</p>
      ) : null}
      <div
        className={cn(
          "px-3.5 pb-3.5",
          !enabled && "pointer-events-none opacity-55",
        )}
        aria-disabled={!enabled}
      >
        {children}
      </div>
    </Card>
  );
}

/**
 * One assigned party of a confirmed distribution: the person's initials in a round mark, the seat
 * above the name (Omar 2026-11-15: «حسّن شكله»).
 *
 * How it works: the initials come from the shared `initialsFromDisplayName`; the tile keeps a least
 * width so two or three sit side by side and a long name is cut with «…» (the full name is the title).
 * Edge cases: a seat nobody holds shows `empty` in muted type and «—» in the mark.
 */
function AssignedPartyTile({ seat, name, empty = "لم يُعيَّن" }: { seat: string; name: string; empty?: string }) {
  const assigned = name.trim() !== "";
  return (
    <li className="flex min-w-[200px] max-w-full flex-1 items-center gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 sm:max-w-[300px]">
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold",
          assigned
            ? "border-border/80 bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] text-gold-d"
            : "border-dashed border-border-md bg-surface text-text-3",
        )}
      >
        {assigned ? initialsFromDisplayName(name) : "—"}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11.5px] leading-4 text-text-3">{seat}</span>
        <span
          className={cn(
            "truncate text-[14px] leading-5",
            assigned ? "font-bold text-heading" : "font-medium text-text-3",
          )}
          title={assigned ? name : undefined}
        >
          {assigned ? name : empty}
        </span>
      </span>
    </li>
  );
}

type Props = {
  distribution: TaskDistributionDraft;
  onPatch: (patch: Partial<TaskDistributionDraft>) => void;
  showEngineering: boolean;
  engineeringHint?: string | null;
  readOnly?: boolean;
  /**
   * The read-only view's own action («تعديل إسناد الأطراف»): beside the parties on the work page's
   * layout (Omar 2026-11-15: at the side, not under them), under the form elsewhere.
   */
  action?: React.ReactNode;
};

export function DistributionPartiesForm({
  distribution,
  onPatch,
  showEngineering,
  engineeringHint,
  readOnly = false,
  action,
}: Props) {
  const { data: staffResult } = useDistributionAssigneesQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult]);
  const loadError = staffResult?.loadError ?? null;
  const loadByAssignee = useMemo(
    () => buildAssigneeOpenLoadMap(workflowTasks),
    [workflowTasks],
  );
  const fieldInspectors = useMemo(
    () => getFieldInspectors(staffUsers),
    [staffUsers],
  );
  const valuators = useMemo(() => getValuators(staffUsers), [staffUsers]);
  const engineeringOffices = useMemo(
    () => getEngineeringOffices(staffUsers),
    [staffUsers],
  );
  const work = useWorkDensity();

  // The work page's layout (`work` density): a confirmed distribution reads as who was assigned, not
  // as disabled pickers in cards (Omar 2026-11-09) — one tile per party, with the section's action at
  // the row's end (2026-11-15). On a phone the tiles stack and the action takes its own line.
  if (work && readOnly) {
    const nameOf = (list: { id: string; name: string }[], id: string) =>
      list.find((a) => a.id === id)?.name ?? (id ? id : "");
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ul className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-3 p-0">
          <AssignedPartyTile seat="المعاين الميداني" name={nameOf(fieldInspectors, distribution.inspectorId)} />
          <AssignedPartyTile seat="المقيّم العقاري" name={nameOf(valuators, distribution.valuatorId)} />
          {showEngineering ? (
            <AssignedPartyTile
              seat="المكتب الهندسي"
              name={
                distribution.engineeringOffice
                  ? nameOf(engineeringOffices, distribution.engineeringOfficeId)
                  : ""
              }
              empty="لا يوجد"
            />
          ) : null}
        </ul>
        {action ? <div className="shrink-0 max-sm:w-full">{action}</div> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {loadError ? (
        <Note tone="danger" className="border border-border text-[11px]">
          {loadError}
        </Note>
      ) : null}

      {/* No case specialist is picked here (ruling 2026-11-02): after the formal receipt the
          transaction lands in the shared «دراسة العقار» queue. */}
      <PartyBlock
        readOnly={readOnly}
        required
        enabled
        title="قسم التقييم العقاري"
        hint="المعاين والمقيّم يُعيَّنان دائماً. اختيار المقيّم من قائمة صلاحيات التقييم."
        onEnabledChange={() => undefined}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <RegSelect
            id="dist_val_inspector"
            label="المعاين الميداني"
            required
            disabled={readOnly}
            options={assigneeLoadOptions(fieldInspectors, loadByAssignee)}
            value={distribution.inspectorId}
            placeholder="اختر المعاين…"
            onChange={(v) =>
              onPatch({ valuationDepartment: true, inspectorId: v })
            }
          />
          <RegSelect
            id="dist_val_appraiser"
            label="المقيّم العقاري"
            required
            disabled={readOnly}
            options={assigneeLoadOptions(valuators, loadByAssignee)}
            value={distribution.valuatorId}
            placeholder="اختر المقيّم…"
            onChange={(v) =>
              onPatch({ valuationDepartment: true, valuatorId: v })
            }
          />
        </div>
      </PartyBlock>

      {showEngineering ? (
        <PartyBlock
          readOnly={readOnly}
          enabled={distribution.engineeringOffice}
          title="المكتب الهندسي"
          onEnabledChange={(checked) =>
            onPatch({
              engineeringOffice: checked,
              engineeringOfficeId: checked
                ? distribution.engineeringOfficeId
                : "",
            })
          }
        >
          <RegSelect
            id="dist_engineering_office"
            label="المكتب"
            required={distribution.engineeringOffice}
            disabled={readOnly || !distribution.engineeringOffice}
            options={assigneeLoadOptions(engineeringOffices, loadByAssignee)}
            value={distribution.engineeringOfficeId}
            placeholder="اختر المكتب الهندسي…"
            onChange={(v) => onPatch({ engineeringOfficeId: v })}
          />
        </PartyBlock>
      ) : engineeringHint ? (
        <Note tone="default" className="border border-border bg-surface-2 text-[11px]">
          {engineeringHint}
        </Note>
      ) : null}
      {readOnly && action ? <div>{action}</div> : null}
    </div>
  );
}