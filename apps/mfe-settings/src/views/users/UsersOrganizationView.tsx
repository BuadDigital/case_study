"use client";

import type { OrgDepartment, OrgPerson } from "@platform/types";
import {
  Badge,
  Note,
  PageGutter,
  PanelSkeleton,
  SubpageHeader,
  SubpagePanel,
} from "@platform/design-system";
import { useOrganizationQuery } from "../../query/settings-queries";
import { DevSystemResetPanel } from "../../components/DevSystemResetPanel";

function roleLabel(systemRole: string) {
  if (systemRole === "CDO") return "مسؤول التحول الرقمي";
  if (systemRole === "HrAdmin") return "أخصائية موارد بشرية";
  if (systemRole === "ProcAdmin") return "مدير المالية والعقود";
  if (systemRole === "CrmAdmin") return "مدير علاقات العملاء";
  return systemRole;
}

function PersonCard({
  person,
  badge,
}: {
  person: OrgPerson;
  badge?: string;
}) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface-2 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">{person.displayName}</span>
        {badge ? (
          <Badge tone="info" className="">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="text-xs text-text-2">{roleLabel(person.systemRole)}</div>
      <div className="text-[11px] text-text-3" dir="ltr">
        {person.email}
      </div>
      {person.jobTitle ? (
        <div className="mt-1 text-[11px] text-text-2">{person.jobTitle}</div>
      ) : null}
    </div>
  );
}

function DepartmentCard({ dept }: { dept: OrgDepartment }) {
  return (
    <SubpagePanel className="mb-0">
      <SubpageHeader title={dept.title}>
        {dept.isActive ? (
          <Badge tone="success" className="">
            مفعّل
          </Badge>
        ) : (
          <Badge tone="warning" className="">
            مرحلة مستقبلية
          </Badge>
        )}
      </SubpageHeader>
      <PageGutter className="pb-4">
        <p className="mb-3 text-xs leading-relaxed text-text-2">{dept.description}</p>
        {dept.admin ? (
          <PersonCard person={dept.admin} />
        ) : (
          <p className="text-xs text-text-3">لم يُعيَّن مدير بعد.</p>
        )}
      </PageGutter>
    </SubpagePanel>
  );
}

export function UsersOrganizationView() {
  const { data, isPending } = useOrganizationQuery();
  const overview = data?.overview;
  const loadError = data?.loadError ?? null;

  return (
    <>
      <Note className="mb-4 flex flex-col gap-1">
        <strong>هيكل الإدارات ومديري الأنظمة</strong>
        <span>
          عرض فقط — إنشاء الموظفين والموردين والعملاء يتم من قبل مدير كل إدارة، وليس
          من شاشة CDO.
        </span>
      </Note>

      {loadError ? (
        <Note tone="danger" className="mb-3">
          {loadError}
        </Note>
      ) : null}

      <SubpagePanel className="mb-4">
        <SubpageHeader title="مسؤول التحول الرقمي (CDO)">
          <Badge tone="default" className="">
            اطلاع فقط
          </Badge>
        </SubpageHeader>
        <PageGutter className="pb-4" data-pending={isPending}>
          {overview?.cdo ? (
            <PersonCard person={overview.cdo} badge="USR-001" />
          ) : !isPending ? (
            <p className="text-xs text-text-3">—</p>
          ) : null}
        </PageGutter>
      </SubpagePanel>

      <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3 sm:px-6">
        الإدارات الفرعية
      </div>
      {isPending && !overview ? (
        <SubpagePanel>
          <PanelSkeleton />
        </SubpagePanel>
      ) : (
        overview?.departments.map((dept) => (
          <DepartmentCard key={dept.code} dept={dept} />
        ))
      )}

      <DevSystemResetPanel />
    </>
  );
}
