"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PriorDeedRegistrationDto } from "@platform/api-client";
import {
  DetailBadge,
  EmptyState,
  InfoBox,
  SectionHeader,
} from "./PropertyDetailFields";
import { poPropertiesPath, poPropertyPath } from "../../lib/po-routes";
import {
  formatPropertyDeedDisplay,
  formatPropertyLocation,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  findPriorDeedFull,
  getPoRecord,
} from "../../lib/prototype/po-intake-storage";
import { loadCaseStudyFormDraft } from "../../lib/prototype/case-study-form-storage";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useOperationsTasksQuery } from "../../query/operations-tasks-queries";
import {
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
} from "../../lib/prototype/operations-task-display";
import { canManageOperationsTasks } from "../../lib/prototype/operations-task-roles";
import { isActiveOperationsTask } from "../../lib/prototype/operations-tasks-storage";

type LinkedSamePo = {
  kind: "same-po";
  property: PoPropertyIntake;
  index: number;
};

type LinkedPrior = {
  kind: "prior-deed";
  prior: PriorDeedRegistrationDto;
  propertyId?: string;
};

type LinkedDeclared = {
  kind: "declared";
  deedNumber: string;
  notes?: string;
};

function parseDeclaredDeeds(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,،;\n]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function PropertyDetailLinkedTab({
  record,
  property,
  caseStudyTask,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  caseStudyTask: WorkflowTask | null;
}) {
  const { role } = usePrototype();
  const canCreateOps = canManageOperationsTasks(role);
  const { data: opsTasks = [] } = useOperationsTasksQuery({ live: true });
  const poNumber = record.poNumber.trim();
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;

  const propertyOpsTasks = useMemo(() => {
    return opsTasks.filter((t) => {
      if (t.poNumber?.trim() === poNumber) {
        if (t.scope === "work_order" || t.scope === "multi") return true;
        if (t.scope === "transaction") {
          return t.deeds.some(
            (d) => d === deedDisplay || d === deedNumber || d.includes(deedNumber),
          );
        }
      }
      return t.deeds.some(
        (d) => d === deedDisplay || d === deedNumber || (deedNumber && d.includes(deedNumber)),
      );
    });
  }, [opsTasks, poNumber, deedDisplay, deedNumber]);

  const createHref = `/operations-tasks?create=1&type=general&scope=transaction&po=${encodeURIComponent(poNumber)}&deed=${encodeURIComponent(deedDisplay)}`;

  const samePoLinks = useMemo<LinkedSamePo[]>(
    () =>
      record.properties
        .filter((p) => p.id !== property.id)
        .map((p) => ({
          kind: "same-po" as const,
          property: p,
          index: record.properties.findIndex((x) => x.id === p.id) + 1,
        })),
    [record.properties, property.id],
  );

  const [prior, setPrior] = useState<LinkedPrior | null>(null);
  const [declared, setDeclared] = useState<LinkedDeclared[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [priorHit, draft] = await Promise.all([
          deedNumber
            ? findPriorDeedFull(deedNumber, poNumber)
            : Promise.resolve(null),
          caseStudyTask
            ? loadCaseStudyFormDraft(caseStudyTask.id)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (priorHit?.poNumber?.trim()) {
          const priorPo = priorHit.poNumber.trim();
          let propertyId: string | undefined;
          try {
            const priorRecord = await getPoRecord(priorPo);
            const match = priorRecord?.properties.find(
              (p) => p.deedNumber.trim() === deedNumber,
            );
            propertyId = match?.id;
          } catch {
            propertyId = undefined;
          }
          if (!cancelled) {
            setPrior({ kind: "prior-deed", prior: priorHit, propertyId });
          }
        } else if (!cancelled) {
          setPrior(null);
        }

        const linkedYes = draft?.infathLinkedAssets === "yes";
        const declaredDeeds = linkedYes
          ? parseDeclaredDeeds(draft?.infathLinkedDeedNumbers ?? "")
          : [];
        if (!cancelled) {
          setDeclared(
            declaredDeeds
              .filter((d) => d !== deedNumber)
              .map((d) => ({
                kind: "declared" as const,
                deedNumber: d,
                notes: draft?.infathLinkedAssetsNotes?.trim() || undefined,
              })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [deedNumber, poNumber, caseStudyTask]);

  const hasAny =
    samePoLinks.length > 0 || Boolean(prior) || declared.length > 0;

  if (loading && !hasAny) {
    return (
      <>
        <SectionHeader>العقارات المرتبطة</SectionHeader>
        <p className="m-0 text-[12px] text-text-3">جاري البحث عن الارتباطات…</p>
      </>
    );
  }

  if (!hasAny) {
    return (
      <>
        <SectionHeader>العقارات المرتبطة</SectionHeader>
        <EmptyState
          icon="🔗"
          title="لا توجد عقارات مرتبطة"
          sub="يظهر هنا: عقارات أخرى على نفس أمر العمل، أو نفس الصك في أمر عمل سابق، أو أصول مرتبطة صرّح بها الأخصائي في دراسة الحالة."
        />
        {record.expectedPropertyCount > record.properties.length ? (
          <InfoBox icon="ℹ">
            أمر العمل يتوقع {record.expectedPropertyCount} عقاراً — المسجّل
            حالياً {record.properties.length} فقط.
          </InfoBox>
        ) : null}
      </>
    );
  }

  return (
    <>
      <SectionHeader>العقارات المرتبطة</SectionHeader>
      <InfoBox icon="ℹ">
        الارتباطات تشمل عقارات نفس أمر العمل، وتسجيلات سابقة لنفس الصك، والأصول
        المرتبطة المصرّح بها في دراسة الحالة، والمهام التشغيلية المرتبطة.
      </InfoBox>

      <div className="mt-3">
        <h4 className="mb-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-text">
          <span>المهام التشغيلية</span>
          {canCreateOps ? (
            <Link
              href={createHref}
              className="text-[11px] font-semibold text-primary-light no-underline hover:underline"
            >
              إنشاء مهمة
            </Link>
          ) : null}
        </h4>
        {propertyOpsTasks.length === 0 ? (
          <p className="m-0 text-[12px] text-text-3">لا مهام مرتبطة بهذا الصك.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {propertyOpsTasks.map((task) => (
              <li key={task.id} className="m-0">
                <Link
                  href={`/operations-tasks?task=${encodeURIComponent(task.id)}`}
                  className="flex flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 no-underline transition-colors hover:border-primary-light hover:bg-info-bg"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-primary-light">
                      {task.title}
                    </span>
                    <DetailBadge tone={isActiveOperationsTask(task) ? "amber" : "gray"}>
                      {operationsTaskStatusLabel(task.status)}
                    </DetailBadge>
                  </span>
                  <span className="text-[11px] text-text-3">
                    {task.displayId} · {operationsTaskTypeLabel(task.type)} ·{" "}
                    {task.assigneeName || "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {samePoLinks.length > 0 ? (
        <div className="mt-3">
          <h4 className="mb-2 text-[12px] font-semibold text-text">
            على نفس أمر العمل
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {samePoLinks.map(({ property: linked, index }) => (
              <li key={linked.id} className="m-0">
                <Link
                  href={poPropertyPath(poNumber, linked.id)}
                  className="flex flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 no-underline transition-colors hover:border-primary-light hover:bg-info-bg"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-primary-light">
                      {formatPropertyDeedDisplay(linked)}
                    </span>
                    <DetailBadge tone="teal">نفس PO</DetailBadge>
                  </span>
                  <span className="text-[11px] text-text-3">
                    عقار {index} · {formatPropertyLocation(linked) || "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prior ? (
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-semibold text-text">
            نفس الصك في أمر عمل سابق
          </h4>
          <Link
            href={
              prior.propertyId
                ? poPropertyPath(prior.prior.poNumber, prior.propertyId)
                : poPropertiesPath(prior.prior.poNumber)
            }
            className="flex flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 no-underline transition-colors hover:border-primary-light hover:bg-info-bg"
          >
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-primary-light">
                {prior.prior.poNumber}
              </span>
              <DetailBadge tone="amber">تسجيل سابق</DetailBadge>
            </span>
            <span className="text-[11px] text-text-3">
              {[prior.prior.ownerName, prior.prior.city, prior.prior.district]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
          </Link>
        </div>
      ) : null}

      {declared.length > 0 ? (
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-semibold text-text">
            أصول مرتبطة (من دراسة الحالة)
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {declared.map((item) => (
              <li
                key={item.deedNumber}
                className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text">
                    صك {item.deedNumber}
                  </span>
                  <DetailBadge tone="gray">مصرّح به</DetailBadge>
                </div>
                {item.notes ? (
                  <p className="mt-1 mb-0 text-[11px] text-text-3">{item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
