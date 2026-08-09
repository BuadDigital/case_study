"use client";

import { useMemo } from "react";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { Card, Note, cn } from "@platform/design-system";
import {
  getCaseSpecialists,
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
  type DistributionAssignee,
} from "../../lib/prototype/distribution-parties";
import {
  buildAssigneeOpenLoadMap,
  openLoadForAssignee,
  withOpenLoadLabel,
} from "../../lib/prototype/distribution-load";
import type { TaskDistributionDraft } from "../../lib/prototype/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

function toOptions(
  list: DistributionAssignee[],
  loadByAssignee: Map<string, number>,
) {
  return list.map((a) => {
    const base = a.subtitle ? `${a.name} — ${a.subtitle}` : a.name;
    const count = openLoadForAssignee(loadByAssignee, a.id);
    return {
      value: a.id,
      label: withOpenLoadLabel(base, count),
    };
  });
}

function PartyBlock({
  enabled,
  title,
  onEnabledChange,
  readOnly,
  children,
}: {
  enabled: boolean;
  title: string;
  onEnabledChange: (checked: boolean) => void;
  readOnly?: boolean;
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

type Props = {
  distribution: TaskDistributionDraft;
  onPatch: (patch: Partial<TaskDistributionDraft>) => void;
  showEngineering: boolean;
  engineeringHint?: string | null;
  readOnly?: boolean;
};

export function DistributionPartiesForm({
  distribution,
  onPatch,
  showEngineering,
  engineeringHint,
  readOnly = false,
}: Props) {
  const { data: staffResult } = useDistributionAssigneesQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();
  const staffUsers = staffResult?.users ?? [];
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
  /** أخصائي عادي فقط — المشرف غير مدرج في قائمة التوزيع */
  const caseSpecialists = useMemo(
    () => getCaseSpecialists(staffUsers),
    [staffUsers],
  );

  return (
    <div className="flex flex-col gap-3">
      {loadError ? (
        <Note tone="danger" className="border border-border text-[11px]">
          {loadError}
        </Note>
      ) : null}

      <PartyBlock
        readOnly={readOnly}
        enabled={distribution.caseSpecialist}
        title="أخصائي دراسة الحالة"
        onEnabledChange={(checked) =>
          onPatch({
            caseSpecialist: checked,
            caseSpecialistId: checked ? distribution.caseSpecialistId : "",
          })
        }
      >
        <RegSelect
          id="dist_case_specialist"
          label="الأخصائي"
          required={distribution.caseSpecialist}
          disabled={readOnly || !distribution.caseSpecialist}
          options={toOptions(caseSpecialists, loadByAssignee)}
          value={distribution.caseSpecialistId}
          placeholder="اختر أخصائي دراسة الحالة…"
          onChange={(v) => onPatch({ caseSpecialistId: v })}
        />
      </PartyBlock>

      <PartyBlock
        readOnly={readOnly}
        enabled={distribution.valuationDepartment}
        title="قسم التقييم العقاري"
        onEnabledChange={(checked) =>
          onPatch({
            valuationDepartment: checked,
            inspectorId: checked ? distribution.inspectorId : "",
            valuatorId: checked ? distribution.valuatorId : "",
          })
        }
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <RegSelect
            id="dist_val_inspector"
            label="المعاين الميداني"
            required={distribution.valuationDepartment}
            disabled={readOnly || !distribution.valuationDepartment}
            options={toOptions(fieldInspectors, loadByAssignee)}
            value={distribution.inspectorId}
            placeholder="اختر المعاين…"
            onChange={(v) => onPatch({ inspectorId: v })}
          />
          <RegSelect
            id="dist_val_appraiser"
            label="المقيم العقاري"
            required={distribution.valuationDepartment}
            disabled={readOnly || !distribution.valuationDepartment}
            options={toOptions(valuators, loadByAssignee)}
            value={distribution.valuatorId}
            placeholder="اختر المقيم…"
            onChange={(v) => onPatch({ valuatorId: v })}
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
            options={toOptions(engineeringOffices, loadByAssignee)}
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
    </div>
  );
}