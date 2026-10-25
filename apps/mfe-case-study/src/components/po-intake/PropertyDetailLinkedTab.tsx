"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PriorDeedRegistrationDto } from "@platform/api-client";
import {
  DetailBadge,
  EmptyState,
  InfoBox,
  SectionHeader,
} from "./PropertyDetailFields";
import { poPropertiesPath, poPropertyPath } from "@platform/app-shared/domain/po-routes";
import {
  formatPropertyDeedDisplay,
  formatPropertyLocation,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  findPriorDeedFull,
  listPriorDeedsFull,
} from "../../lib/app-data/po-intake-reads";
import { loadCaseStudyReportDraft } from "../../lib/app-data/case-study-report-reads";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useOperationsTasksQuery } from "../../query/operations-tasks-queries";
import {
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
} from "../../lib/app-data/operations-task-display";
import { canManageOperationsTasks } from "../../lib/app-data/operations-task-roles";
import { isActiveOperationsTask } from "../../lib/app-data/operations-tasks-model";
import { filterOperationsTasksForProperty } from "../../lib/app-data/operations-task-property-scope";
import { deedsMatch, normalizeDeedNumber } from "../../lib/app-data/deed-number";
import { useTransactionQuery } from "../../query/use-transaction-query";
import { transactionDeedLabel } from "./TransactionDeedSwitcher";
import { formatPoDisplay } from "../../lib/app-data/po-intake-data";
import { TransactionMergeDialog, invalidateTransactionViews } from "./TransactionMergeDialog";
import { isCaseStudySpecialist } from "../../lib/app-data/po-roles";
import { useQueryClient } from "@tanstack/react-query";
import { Button, promptAction, useToast } from "@platform/ui-kit";
import { unmergeTransactionDeed } from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";

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
  resolvedPrior?: PriorDeedRegistrationDto | null;
  resolvedPropertyId?: string;
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

function priorPropertyId(prior: PriorDeedRegistrationDto): string | undefined {
  const id = prior.propertyId?.trim();
  return id || undefined;
}

function priorHref(item: LinkedPrior): string {
  const id = item.propertyId || priorPropertyId(item.prior);
  return id
    ? poPropertyPath(item.prior.poNumber, id)
    : poPropertiesPath(item.prior.poNumber);
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
  const { role } = useAppAccess();
  const canCreateOps = canManageOperationsTasks(role);
  const { data: opsTasks = [] } = useOperationsTasksQuery({ live: true });
  const poNumber = record.poNumber.trim();
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;

  const propertyOpsTasks = useMemo(
    () => filterOperationsTasksForProperty(opsTasks, { poNumber, deedNumber, deedDisplay }),
    [opsTasks, poNumber, deedDisplay, deedNumber],
  );

  const createHref = `/operations-tasks?create=1&type=general&scope=transaction&po=${encodeURIComponent(poNumber)}&deed=${encodeURIComponent(deedDisplay)}`;

  const samePoLinks = useMemo<LinkedSamePo[]>(
    () =>
      record.properties
        .filter((p) => p.id !== property.id && !p.isRemoved)
        .map((p) => ({
          kind: "same-po" as const,
          property: p,
          index: record.properties.findIndex((x) => x.id === p.id) + 1,
        })),
    [record.properties, property.id],
  );

  // Decision 2026-10-19: the deeds of this transaction come first — they ARE the property.
  const { data: transaction } = useTransactionQuery(property.id);
  const transactionDeeds = useMemo(
    () => (transaction?.deeds ?? []).filter((d) => d.propertyId !== property.id && !d.isRemoved),
    [transaction, property.id],
  );
  const canMerge = isCaseStudySpecialist(role);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [unmergingId, setUnmergingId] = useState<string | null>(null);

  async function unmerge(deedPropertyId: string, label: string) {
    const config = workOrdersApiConfig();
    if (!config || !transaction || unmergingId) return;
    const reason = await promptAction({
      title: `إخراج الصك ${label} من المعاملة`,
      message: "يفتح للصك معاملة مسودة جديدة بمعاينته. المبرر إلزامي ويُسجَّل في التدقيق.",
      label: "مبرر الإخراج",
      confirmLabel: "إخراج",
      minLength: 5,
    });
    if (reason === null) return;
    setUnmergingId(deedPropertyId);
    try {
      const res = await unmergeTransactionDeed(config, transaction.id, { propertyId: deedPropertyId, reason });
      if (!res.ok) {
        showToast(res.message ?? "تعذّر إخراج الصك", "error");
        return;
      }
      invalidateTransactionViews(queryClient, transaction.deeds.map((d) => d.poNumber));
      showToast(`أُخرج الصك ${label} إلى معاملة جديدة`, "success");
    } finally {
      setUnmergingId(null);
    }
  }

  const [priors, setPriors] = useState<LinkedPrior[]>([]);
  const [declared, setDeclared] = useState<LinkedDeclared[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // The tab sits in an <Activity>: showing it again (or a refetched task list) re-runs
  // the lookup for links already on screen — refresh them without the «جاري البحث» line.
  const loadedKeyRef = useRef<string | null>(null);
  const loadKey = `${property.id}|${deedNumber}|${poNumber}|${caseStudyTask?.id ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    const silent = loadedKeyRef.current === loadKey;

    async function load() {
      if (!silent) {
        setLoading(true);
        setLookupError(null);
      }
      try {
        const [history, draft] = await Promise.all([
          deedNumber
            ? listPriorDeedsFull(deedNumber, poNumber, property.id).catch(
                (err: unknown) => {
                  // Fallback to single latest when history endpoint is unavailable.
                  return findPriorDeedFull(
                    deedNumber,
                    poNumber,
                    property.id,
                  ).then((one) => (one ? [one] : []));
                },
              )
            : Promise.resolve([] as PriorDeedRegistrationDto[]),
          caseStudyTask
            ? loadCaseStudyReportDraft(caseStudyTask.id)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const priorRows: LinkedPrior[] = (history ?? []).map((hit) => ({
          kind: "prior-deed" as const,
          prior: hit,
          propertyId: priorPropertyId(hit),
        }));
        setPriors(priorRows);
        setLookupError(null);

        const linkedYes = draft?.infathLinkedAssets === "yes";
        const declaredDeeds = linkedYes
          ? parseDeclaredDeeds(draft?.infathLinkedDeedNumbers ?? "")
          : [];
        const declaredRows: LinkedDeclared[] = await Promise.all(
          declaredDeeds
            .filter((d) => !deedsMatch(d, deedNumber))
            .map(async (d) => {
              let resolvedPrior: PriorDeedRegistrationDto | null = null;
              try {
                resolvedPrior = await findPriorDeedFull(d, poNumber);
              } catch {
                resolvedPrior = null;
              }
              // Also resolve siblings on the same PO.
              const samePo =
                resolvedPrior == null
                  ? record.properties.find(
                      (p) =>
                        !p.isRemoved &&
                        p.id !== property.id &&
                        deedsMatch(p.deedNumber, d),
                    )
                  : null;
              return {
                kind: "declared" as const,
                deedNumber: d,
                notes: draft?.infathLinkedAssetsNotes?.trim() || undefined,
                resolvedPrior:
                  resolvedPrior ??
                  (samePo
                    ? ({
                        poNumber,
                        propertyId: samePo.id,
                        deedNumber: samePo.deedNumber,
                        ownerName: samePo.ownerName,
                        city: samePo.city,
                        district: samePo.district,
                      } as PriorDeedRegistrationDto)
                    : null),
                resolvedPropertyId:
                  priorPropertyId(resolvedPrior ?? ({} as PriorDeedRegistrationDto)) ||
                  samePo?.id,
              };
            }),
        );
        if (!cancelled) setDeclared(declaredRows);
      } catch (err) {
        if (!cancelled) {
          setPriors([]);
          setLookupError(
            err instanceof Error
              ? err.message
              : "تعذّر تحميل الارتباطات",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          loadedKeyRef.current = loadKey;
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadKey, deedNumber, poNumber, caseStudyTask, property.id, record.properties]);

  const linkCount =
    transactionDeeds.length +
    samePoLinks.length +
    priors.length +
    declared.length +
    propertyOpsTasks.length;

  const hasAny = linkCount > 0;

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
        {lookupError ? (
          <InfoBox icon="⚠">{lookupError}</InfoBox>
        ) : (
          <EmptyState
            icon="🔗"
            title="لا توجد عقارات مرتبطة"
            sub="يظهر هنا: صكوك هذه المعاملة، وعقارات أخرى على نفس أمر العمل، أو نفس الصك في أوامر عمل سابقة، أو أصول مرتبطة صرّح بها الأخصائي في دراسة الحالة، والمهام التشغيلية."
          />
        )}
        {record.expectedPropertyCount > record.properties.filter((p) => !p.isRemoved).length ? (
          <InfoBox icon="ℹ">
            أمر العمل يتوقع {record.expectedPropertyCount} عقاراً — المسجّل
            حالياً {record.properties.filter((p) => !p.isRemoved).length} فقط.
          </InfoBox>
        ) : null}
      </>
    );
  }

  return (
    <>
      <SectionHeader>
        العقارات المرتبطة
        <span className="ms-2 text-[11px] font-semibold text-text-3">
          ({linkCount})
        </span>
      </SectionHeader>
      {lookupError ? <InfoBox icon="⚠">{lookupError}</InfoBox> : null}
      <InfoBox icon="ℹ">
        الارتباطات تشمل صكوك هذه المعاملة، وعقارات نفس أمر العمل، وتسجيلات
        سابقة لنفس الصك (كل الدراسات)، والأصول المرتبطة المصرّح بها في دراسة
        الحالة، والمهام التشغيلية المرتبطة.
      </InfoBox>

      {transaction && (transactionDeeds.length > 0 || canMerge) ? (
        <div className="mt-3">
          <h4 className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold text-text">
            <span>
              صكوك هذه المعاملة ({transactionDeeds.length + 1})
              <span className="ms-2 text-[11px] font-normal text-text-3">
                <bdi dir="ltr">{transaction.displayNumber}</bdi>
                {transaction.linkKindLabelAr ? ` · ${transaction.linkKindLabelAr}` : ""}
              </span>
            </span>
            {canMerge ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={Boolean(unmergingId)}
                onClick={() => setMergeOpen(true)}
              >
                دمج صكوك في المعاملة
              </Button>
            ) : null}
          </h4>
          {transactionDeeds.length === 0 ? (
            <p className="m-0 text-[12px] text-text-3">
              المعاملة بصك واحد. يمكن ضم صكوك أخرى تمثل العقار نفسه متى اكتمل استعلام البورصة لها.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {transactionDeeds.map((deed) => {
                const label = transactionDeedLabel(deed);
                return (
                  <li key={deed.propertyId} className="m-0 flex items-stretch gap-2">
                    <Link
                      href={poPropertyPath(deed.poNumber, deed.propertyId)}
                      className="flex min-w-0 flex-1 flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 no-underline transition-colors hover:border-primary-light hover:bg-info-bg"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-primary-light">
                          <bdi dir="ltr">{label}</bdi>
                        </span>
                        <DetailBadge tone="blue">صك في المعاملة</DetailBadge>
                        {deed.deedKindLabelAr ? (
                          <DetailBadge tone="gray">{deed.deedKindLabelAr}</DetailBadge>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-text-3">
                        {formatPoDisplay(deed.poNumber)}
                        {deed.city || deed.district
                          ? ` · ${[deed.city, deed.district].filter(Boolean).join(" — ")}`
                          : ""}
                      </span>
                    </Link>
                    {canMerge && !transaction.referenceNumber ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="self-center"
                        loading={unmergingId === deed.propertyId}
                        disabled={Boolean(unmergingId)}
                        showActionToast={false}
                        title="إخراج الصك إلى معاملة مسودة جديدة — قبل تثبيت الرقم الرسمي فقط"
                        onClick={() => void unmerge(deed.propertyId, label)}
                      >
                        إخراج
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {canMerge && transaction ? (
            <TransactionMergeDialog
              open={mergeOpen}
              transaction={transaction}
              onClose={() => setMergeOpen(false)}
              onMerged={() => setMergeOpen(false)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <h4 className="mb-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-text">
          <span>
            المهام التشغيلية
            {propertyOpsTasks.length > 0
              ? ` (${propertyOpsTasks.length})`
              : ""}
          </span>
          {canCreateOps ? (
            <Link
              href={createHref}
              className="inline-flex min-h-9 items-center text-[11px] font-semibold text-primary-light no-underline hover:underline max-lg:min-h-11 max-lg:px-2"
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
                  className="flex min-h-14 flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 no-underline transition-colors hover:border-primary-light hover:bg-info-bg"
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
            على نفس أمر العمل ({samePoLinks.length})
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

      {priors.length > 0 ? (
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-semibold text-text">
            نفس الصك في أوامر عمل سابقة ({priors.length})
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {priors.map((item) => {
              const key = `${item.prior.poNumber}-${priorPropertyId(item.prior) ?? item.prior.deedNumber ?? ""}`;
              return (
                <li key={key} className="m-0">
                  <Link
                    href={priorHref(item)}
                    className="flex flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 no-underline transition-colors hover:border-primary-light hover:bg-info-bg"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-primary-light">
                        {item.prior.poNumber}
                      </span>
                      <DetailBadge tone="amber">دراسة سابقة</DetailBadge>
                    </span>
                    <span className="text-[11px] text-text-3">
                      {[
                        item.prior.ownerName,
                        item.prior.region,
                        item.prior.city,
                        item.prior.district,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                      {item.prior.workOrderCreatedAtUtc
                        ? ` · ${new Date(item.prior.workOrderCreatedAtUtc).toLocaleDateString("ar-SA-u-nu-latn")}`
                        : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {declared.length > 0 ? (
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-semibold text-text">
            أصول مرتبطة (من دراسة الحالة) ({declared.length})
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {declared.map((item) => {
              const href =
                item.resolvedPrior &&
                (item.resolvedPropertyId || priorPropertyId(item.resolvedPrior))
                  ? poPropertyPath(
                      item.resolvedPrior.poNumber,
                      item.resolvedPropertyId ||
                        priorPropertyId(item.resolvedPrior)!,
                    )
                  : item.resolvedPrior
                    ? poPropertiesPath(item.resolvedPrior.poNumber)
                    : null;
              const body = (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-text">
                      صك {item.deedNumber}
                    </span>
                    <DetailBadge tone="gray">مصرّح به</DetailBadge>
                    {item.resolvedPrior ? (
                      <DetailBadge tone="teal">
                        {item.resolvedPrior.poNumber}
                      </DetailBadge>
                    ) : (
                      <DetailBadge tone="amber">غير موجود في السجل</DetailBadge>
                    )}
                  </div>
                  {item.notes ? (
                    <p className="mt-1 mb-0 text-[11px] text-text-3">{item.notes}</p>
                  ) : null}
                </>
              );
              return (
                <li
                  key={`${normalizeDeedNumber(item.deedNumber)}-${item.deedNumber}`}
                  className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3"
                >
                  {href ? (
                    <Link
                      href={href}
                      className="flex flex-col gap-1 no-underline text-inherit"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}
