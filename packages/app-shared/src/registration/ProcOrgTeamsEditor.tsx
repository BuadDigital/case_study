"use client";

import { Label } from "@platform/design-system";
import { REGIONS, SERVICES } from "../prototype/registration-data";
import { RegSelect } from "./FormFields";
import { RegistrationFormCard } from "./RegistrationFormCard";
import {
  Button,
  RegAddMemberButton,
  RegGrid3,
  RegInfoBox,
  RegInlineInput,
  RegRemoveButton,
} from "./registration-layout";

export type ProcMgmtMember = {
  name: string;
  role: string;
  phone: string;
};

export type ProcOpsMember = {
  name: string;
  role: string;
  phone: string;
};

export type ProcOpsUnit = {
  name: string;
  teamType: string;
  region: string;
  members: ProcOpsMember[];
};

const DEFAULT_MGMT_ROLES = [
  "المدير العام / المفوض",
  "المحاسب",
  "مدير الإدارة",
  "مسؤول المشاريع",
];

function emptyMgmtRow(index: number): ProcMgmtMember {
  return {
    name: "",
    role: index < DEFAULT_MGMT_ROLES.length ? DEFAULT_MGMT_ROLES[index] : "",
    phone: "",
  };
}

function emptyOpsUnit(): ProcOpsUnit {
  return {
    name: "",
    teamType: "",
    region: "",
    members: [{ name: "", role: "", phone: "" }],
  };
}

export function ProcOrgTeamsEditor({
  mgmtTeam,
  opsUnits,
  onMgmtChange,
  onOpsChange,
}: {
  mgmtTeam: ProcMgmtMember[];
  opsUnits: ProcOpsUnit[];
  onMgmtChange: (next: ProcMgmtMember[]) => void;
  onOpsChange: (next: ProcOpsUnit[]) => void;
}) {
  const updateMgmt = (index: number, patch: Partial<ProcMgmtMember>) => {
    onMgmtChange(
      mgmtTeam.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const updateOpsUnit = (index: number, patch: Partial<ProcOpsUnit>) => {
    onOpsChange(
      opsUnits.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)),
    );
  };

  const updateOpsMember = (
    unitIndex: number,
    memberIndex: number,
    patch: Partial<ProcOpsMember>,
  ) => {
    onOpsChange(
      opsUnits.map((unit, ui) => {
        if (ui !== unitIndex) return unit;
        return {
          ...unit,
          members: unit.members.map((m, mi) =>
            mi === memberIndex ? { ...m, ...patch } : m,
          ),
        };
      }),
    );
  };

  return (
    <>
      <RegistrationFormCard
        title="فريق الإدارة"
        subtitle="بيانات تواصل — لا يملكون حسابات حالياً"
        headerRight={
          <Button
            type="button"
            size="sm"
            onClick={() => onMgmtChange([...mgmtTeam, emptyMgmtRow(mgmtTeam.length)])}
          >
            + إضافة
          </Button>
        }
      >
        {mgmtTeam.map((row, index) => (
          <div
            key={`mgmt-${index}`}
            className="mb-1.5 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5 rounded border border-border bg-surface-2 p-2 max-[600px]:grid-cols-2"
          >
            <RegInlineInput
              placeholder="الاسم الكامل"
              value={row.name}
              onChange={(e) => updateMgmt(index, { name: e.target.value })}
            />
            <RegInlineInput
              placeholder="المنصب"
              value={row.role}
              onChange={(e) => updateMgmt(index, { role: e.target.value })}
            />
            <RegInlineInput
              placeholder="رقم الجوال"
              value={row.phone}
              onChange={(e) => updateMgmt(index, { phone: e.target.value })}
            />
            <RegRemoveButton
              label="حذف"
              onClick={() =>
                onMgmtChange(mgmtTeam.filter((_, i) => i !== index))
              }
            />
          </div>
        ))}
        <RegInfoBox className="mt-2">
          يمكن تحويل أي منهم لحساب مستقل لاحقاً بطلب من مدير النظام.
        </RegInfoBox>
      </RegistrationFormCard>

      <RegistrationFormCard
        title="الفرق التشغيلية / المنافذ"
        subtitle="التغطية الجغرافية وأفراد الفريق"
        headerRight={
          <Button
            type="button"
            size="sm"
            onClick={() => onOpsChange([...opsUnits, emptyOpsUnit()])}
          >
            + إضافة فريق
          </Button>
        }
      >
        {opsUnits.map((unit, unitIndex) => (
          <div
            key={`ops-${unitIndex}`}
            className="mb-2.5 overflow-hidden rounded-lg border border-border"
          >
            <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info-bg text-[10px] font-bold text-info-text">
                {unitIndex + 1}
              </span>
              <span className="flex-1 text-[12.5px] font-bold">
                فريق / منفذ {unitIndex + 1}
              </span>
              <RegRemoveButton
                label="حذف الفريق"
                onClick={() =>
                  onOpsChange(opsUnits.filter((_, i) => i !== unitIndex))
                }
              />
            </div>
            <div className="p-3">
              <RegGrid3 className="mb-2.5">
                <div>
                  <Label className="mb-1 text-[11px] font-semibold text-text-2">
                    اسم الفريق
                  </Label>
                  <RegInlineInput
                    placeholder="مثال: فريق الرياض"
                    value={unit.name}
                    onChange={(e) =>
                      updateOpsUnit(unitIndex, { name: e.target.value })
                    }
                  />
                </div>
                <RegSelect
                  id={`ops_type_${unitIndex}`}
                  label="نوع الفريق"
                  options={SERVICES}
                  value={unit.teamType}
                  onChange={(v) => updateOpsUnit(unitIndex, { teamType: v })}
                />
                <RegSelect
                  id={`ops_region_${unitIndex}`}
                  label="التغطية الجغرافية"
                  options={REGIONS}
                  value={unit.region}
                  onChange={(v) => updateOpsUnit(unitIndex, { region: v })}
                />
              </RegGrid3>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-3">
                أفراد الفريق (بيانات تواصل)
              </div>
              {unit.members.map((member, memberIndex) => (
                <div
                  key={`mem-${unitIndex}-${memberIndex}`}
                  className="mb-1 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1.5"
                >
                  <RegInlineInput
                    placeholder="الاسم"
                    value={member.name}
                    onChange={(e) =>
                      updateOpsMember(unitIndex, memberIndex, {
                        name: e.target.value,
                      })
                    }
                  />
                  <RegInlineInput
                    placeholder="الدور"
                    value={member.role}
                    onChange={(e) =>
                      updateOpsMember(unitIndex, memberIndex, {
                        role: e.target.value,
                      })
                    }
                  />
                  <RegInlineInput
                    placeholder="الجوال"
                    value={member.phone}
                    onChange={(e) =>
                      updateOpsMember(unitIndex, memberIndex, {
                        phone: e.target.value,
                      })
                    }
                  />
                  <RegRemoveButton
                    label="حذف"
                    onClick={() =>
                      updateOpsUnit(unitIndex, {
                        members: unit.members.filter((_, i) => i !== memberIndex),
                      })
                    }
                  />
                </div>
              ))}
              <RegAddMemberButton
                onClick={() =>
                  updateOpsUnit(unitIndex, {
                    members: [
                      ...unit.members,
                      { name: "", role: "", phone: "" },
                    ],
                  })
                }
              >
                + إضافة فرد
              </RegAddMemberButton>
            </div>
          </div>
        ))}
      </RegistrationFormCard>
    </>
  );
}

export function defaultProcMgmtTeam(): ProcMgmtMember[] {
  return [emptyMgmtRow(0), emptyMgmtRow(1)];
}

export function defaultProcOpsUnits(): ProcOpsUnit[] {
  return [emptyOpsUnit()];
}
