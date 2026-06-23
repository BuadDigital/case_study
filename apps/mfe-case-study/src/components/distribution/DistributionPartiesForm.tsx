"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { Card, CardBody, Note, cn } from "@platform/design-system";
import {
  getEngineeringOffices,
  getFieldInspectors,
  getGovernmentAuditors,
  getValuationCoordinators,
  getValuators,
  type DistributionAssignee,
} from "../../lib/prototype/distribution-parties";
import type { TaskDistributionDraft } from "../../lib/prototype/tasks-storage";

function toOptions(list: DistributionAssignee[]) {
  return list.map((a) => ({
    value: a.id,
    label: a.subtitle ? `${a.name} — ${a.subtitle}` : a.name,
  }));
}

function PartyBlock({
  enabled,
  title,
  description,
  onEnabledChange,
  readOnly,
  children,
}: {
  enabled: boolean;
  title: string;
  description: string;
  onEnabledChange: (checked: boolean) => void;
  readOnly?: boolean;
  children: ReactNode;
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
        <div className="min-w-0 flex-1 text-start">
          <p className="m-0 mb-1 text-[13px] font-bold leading-snug text-text">
            {title}
          </p>
          <p className="m-0 text-[11px] leading-normal text-text-3">
            {description}
          </p>
        </div>
      </label>
      <div
        className={cn(
          "border-t border-border bg-surface-2 px-3.5 pb-3.5",
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
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const governmentAuditors = useMemo(
    () => getGovernmentAuditors(staffUsers),
    [staffUsers],
  );
  const valuationCoordinators = useMemo(
    () => getValuationCoordinators(staffUsers),
    [staffUsers],
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

  return (
    <div className="flex flex-col gap-3">
      {!readOnly ? (
        <p className="m-0 mb-1 text-start text-xs leading-snug text-text-2">
          فعّل الطرف ثم اختر المسؤول من القائمة. الطرف غير المفعّل لن يُسند إليه
          أي جزء من المعاملة.
        </p>
      ) : null}

      <PartyBlock
        readOnly={readOnly}
        enabled={distribution.governmentAuditor}
        title="المراجع الحكومي"
        description="زيارة المحكمة وجمع المفاتيح عند التوفر."
        onEnabledChange={(checked) =>
          onPatch({
            governmentAuditor: checked,
            governmentAuditorId: checked
              ? distribution.governmentAuditorId
              : "",
          })
        }
      >
        <div className="pt-3">
          <RegSelect
            id="dist_gov_auditor"
            label="المسؤول"
            required={distribution.governmentAuditor}
            disabled={readOnly || !distribution.governmentAuditor}
            options={toOptions(governmentAuditors)}
            value={distribution.governmentAuditorId}
            placeholder="اختر المراجع الحكومي…"
            onChange={(v) => onPatch({ governmentAuditorId: v })}
          />
        </div>
      </PartyBlock>

      <PartyBlock
        readOnly={readOnly}
        enabled={distribution.valuationDepartment}
        title="قسم التقييم العقاري"
        description="منسق العمليات يستلم المعاملة ثم يُسند للمعاين والمقيم (مستخدمون نشطون في النظام)."
        onEnabledChange={(checked) =>
          onPatch({
            valuationDepartment: checked,
            operationsCoordinatorId: checked
              ? distribution.operationsCoordinatorId
              : "",
            inspectorId: checked ? distribution.inspectorId : "",
            valuatorId: checked ? distribution.valuatorId : "",
          })
        }
      >
        <div className="grid grid-cols-1 gap-2.5 pt-3 sm:grid-cols-3">
          <RegSelect
            id="dist_val_coordinator"
            label="منسق عمليات التقييم"
            required={distribution.valuationDepartment}
            disabled={readOnly || !distribution.valuationDepartment}
            options={toOptions(valuationCoordinators)}
            value={distribution.operationsCoordinatorId}
            placeholder="اختر المنسق…"
            onChange={(v) => onPatch({ operationsCoordinatorId: v })}
          />
          <RegSelect
            id="dist_val_inspector"
            label="المعاين الميداني"
            required={distribution.valuationDepartment}
            disabled={readOnly || !distribution.valuationDepartment}
            options={toOptions(fieldInspectors)}
            value={distribution.inspectorId}
            placeholder="اختر المعاين…"
            onChange={(v) => onPatch({ inspectorId: v })}
          />
          <RegSelect
            id="dist_val_appraiser"
            label="المقيم العقاري"
            required={distribution.valuationDepartment}
            disabled={readOnly || !distribution.valuationDepartment}
            options={toOptions(valuators)}
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
          description="مجموعة مكاتب هندسية لإصدار تقارير الرفع المساحي — حسابات نشطة لإدارة المعاملات الواردة."
          onEnabledChange={(checked) =>
            onPatch({
              engineeringOffice: checked,
              engineeringOfficeId: checked
                ? distribution.engineeringOfficeId
                : "",
            })
          }
        >
          <div className="pt-3">
            <RegSelect
              id="dist_engineering_office"
              label="المكتب"
              required={distribution.engineeringOffice}
              disabled={readOnly || !distribution.engineeringOffice}
              options={toOptions(engineeringOffices)}
              value={distribution.engineeringOfficeId}
              placeholder="اختر المكتب الهندسي…"
              onChange={(v) => onPatch({ engineeringOfficeId: v })}
            />
          </div>
        </PartyBlock>
      ) : engineeringHint ? (
        <Note tone="default" className="border border-border bg-surface-2 text-[11px]">
          {engineeringHint}
        </Note>
      ) : null}
    </div>
  );
}
