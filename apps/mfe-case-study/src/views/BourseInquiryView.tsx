"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Note,
  OperationalPanel,
  QueueTableHint,
  SkeletonTableRows,
  Table,
  TableFrame,
  TBody,
  Td,
  TdAction,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  queueTableRowActiveClassName,
  queueTableRowClassName,
  useToast,
} from "@platform/ui-kit";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { ROLES } from "@platform/app-shared/prototype/constants";
import {
  submitBourseObstruction,
  validateBourseObstructionReason,
} from "../lib/prototype/bourse-obstruction";
import type { BourseDeedVitality } from "../lib/prototype/po-intake-data";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import {
  emptyProperty,
  formatDateAr,
  formatPendingBourseDeedDisplay,
  formatPoDisplay,
  PROPERTY_IDENTIFIER_COLUMN_LABEL,
  type PoPropertyIntake,
} from "../lib/prototype/po-intake-data";
import {
  completePropertyBourse,
  findPropertyInRecord,
} from "../lib/prototype/po-intake-storage";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import {
  usePendingBourseItemsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  hasFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import { PoPropertyBourseForm } from "@case-study/mfe/components/po-intake/PoPropertyBourseForm";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "../lib/domain/po-intake/property-bourse-validation";
import { scheduleScrollToFirstPoPropertyError } from "../lib/domain/po-intake/po-field-error-targets";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import type { PendingBoursePropertyDto } from "@platform/api-client";
import { filterActionablePendingBourseItems } from "../lib/prototype/pending-bourse-queue";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { ActiveQueueMobileCards } from "../components/queue/ActiveQueueMobileCards";
import type { ActiveQueueMobileCardItem } from "../components/queue/ActiveQueueMobileCards";
import { buildBourseQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
import { caseStudyTaskForProperty } from "../lib/prototype/tasks-storage";
import { useRouter } from "next/navigation";
import { poPropertyPath } from "../lib/po-routes";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;

export function BourseInquiryView() {
  const { role } = usePrototype();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    data: rawItems = [],
    isFetched,
    refetch,
  } = usePendingBourseItemsQuery();
  const { data: failures = [] } = useFailuresQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery({ live: true });

  const items = filterActionablePendingBourseItems(rawItems, failures);
  const queuePending = !isFetched;
  const { showToast, runWithActionToast } = useToast();
  const [selected, setSelected] = useState<PendingBoursePropertyDto | null>(null);
  const [property, setProperty] = useState<PoPropertyIntake>(emptyProperty);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deedVitality, setDeedVitality] = useState<BourseDeedVitality | null>(
    null,
  );
  const [obstructionReason, setObstructionReason] = useState("");
  const [obstructionReasonError, setObstructionReasonError] = useState<
    string | undefined
  >();
  const [, startOpenItem] = useTransition();
  const [openingItemKey, setOpeningItemKey] = useState<string | null>(null);

  const itemKey = useCallback(
    (item: Pick<PendingBoursePropertyDto, "poNumber" | "propertyId">) =>
      `${item.poNumber.trim()}|${item.propertyId.trim()}`,
    [],
  );

  const isItemOpening = useCallback(
    (item: Pick<PendingBoursePropertyDto, "poNumber" | "propertyId">) =>
      openingItemKey === itemKey(item),
    [openingItemKey, itemKey],
  );

  const refresh = useCallback(async () => {
    // Invalidating pendingBourseItems refetches the active inquiry on its own —
    // the extra refetch was a duplicate identical GET.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: prototypeKeys.pendingBourseItems(),
      }),
      queryClient.invalidateQueries({
        queryKey: prototypeKeys.workflowTasks(),
      }),
    ]);
  }, [queryClient]);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        const next = { ...p, [key]: value };
        return next;
      });
      setFieldErrors((e) => {
        if (!e[String(key)]) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    },
    [],
  );

  async function openItem(item: PendingBoursePropertyDto) {
    const key = itemKey(item);
    // Toggle close if re-selecting the open row.
    if (
      selected &&
      selected.poNumber === item.poNumber &&
      selected.propertyId === item.propertyId
    ) {
      setOpeningItemKey(null);
      closeForm();
      return;
    }
    setOpeningItemKey(key);
    startOpenItem(() => {
      void (async () => {
        try {
          setSelected(item);
          setFormError(null);
          setFieldErrors({});
          setDeedVitality(null);
          setObstructionReason("");
          setObstructionReasonError(undefined);
          const hit = await findPropertyInRecord(item.poNumber, item.propertyId);
          if (hit) {
            setProperty({ ...hit.property, id: item.propertyId });
          } else {
            setProperty({
              ...emptyProperty(),
              id: item.propertyId,
              deedNumber: item.deedNumber,
              ownerName: item.ownerName ?? "",
              requestNumber: item.requestNumber ?? "",
            });
          }
        } finally {
          window.setTimeout(() => {
            setOpeningItemKey((cur) => (cur === key ? null : cur));
          }, 280);
        }
      })();
    });
  }

  function closeForm() {
    setSelected(null);
    setProperty(emptyProperty());
    setFormError(null);
    setFieldErrors({});
    setDeedVitality(null);
    setObstructionReason("");
    setObstructionReasonError(undefined);
  }

  async function handleSubmit() {
    if (!selected) return;

    if (!deedVitality) {
      setFormError("اختر حالة الصك: فعال أو غير فعال.");
      return;
    }

    if (deedVitality === "inactive") {
      const obstructionError = validateBourseObstructionReason(
        deedVitality,
        obstructionReason,
      );
      if (obstructionError) {
        setObstructionReasonError(obstructionError);
        setFormError(obstructionError);
        scheduleScrollToFormField("obstruction_reason");
        return;
      }

      await runWithActionToast("إرسال للمشرف — إدارة التعذرات", async () => {
        setSaving(true);
        setFormError(null);
        setObstructionReasonError(undefined);
        try {
          await submitBourseObstruction({
            poNumber: selected.poNumber,
            propertyId: selected.propertyId,
            deedNumber: property.deedNumber || selected.deedNumber,
            reason: obstructionReason,
            specialist: ROLES[role]?.name ?? "أخصائي دراسة الحالة",
          });
          closeForm();
          // refresh() invalidates workflowTasks on its own — keep invalidating failures in parallel with it.
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: prototypeKeys.failures(),
            }),
            refresh(),
          ]);
        } finally {
          setSaving(false);
        }
      });
      return;
    }

    const errors = validatePropertyBourseFields(property);
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstBourseValidationMessage(errors));
      scheduleScrollToFirstPoPropertyError(errors, property);
      return;
    }

    await runWithActionToast("حفظ وإكمال البورصة", async () => {
      setSaving(true);
      setFormError(null);
      try {
        const result = await completePropertyBourse(
          selected.poNumber,
          selected.propertyId,
          { ...property, deedStatus: "فعال" },
        );

        if (!result.ok) {
          setFormError(result.error);
          if (result.errors) setFieldErrors(result.errors);
          showToast(result.error, "error");
          throw new Error("save-failed");
        }

        closeForm();
        await refresh();
      } finally {
        setSaving(false);
      }
    });
  }

  const obstructionPath = deedVitality === "inactive";

  const hasRail = isFetched && items.length > 0;
  const panelOpen = Boolean(selected);

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    return items.map((item) => {
      const deedLabel = formatPendingBourseDeedDisplay(item);
      const task = caseStudyTaskForProperty(
        item.poNumber,
        item.propertyId,
        workflowTasks,
      );
      const moreItems = task
        ? buildBourseQueueRowMoreItems({
            task,
            propertyId: item.propertyId,
            openTask: () => void openItem(item),
            router,
            refreshQueue: () => {
              void refresh();
            },
            showToast,
            allowDeleteTransaction: true,
            viewerRole: role,
          })
        : [
            {
              id: "open",
              label: "فتح المعاملة",
              onClick: () => void openItem(item),
            },
            {
              id: "property-detail",
              label: "تفاصيل العقار",
              onClick: () =>
                router.push(poPropertyPath(item.poNumber, item.propertyId)),
            },
          ];
      return {
        id: `${item.poNumber}-${item.propertyId}`,
        title: deedLabel.startsWith("صك") ? deedLabel : `صك ${deedLabel}`,
        meta: [
          { text: formatPoDisplay(item.poNumber), kind: "po" as const },
          item.ownerName?.trim()
            ? { text: item.ownerName.trim(), kind: "type" as const }
            : null,
          item.requestNumber?.trim()
            ? { text: item.requestNumber.trim(), kind: "plain" as const }
            : null,
        ].filter((v): v is NonNullable<typeof v> => Boolean(v)),
        statusLabel: "بانتظار البورصة",
        tone: "pending" as const,
        moreItems,
        onOpen: () => void openItem(item),
        loading: isItemOpening(item),
      };
    });
  }, [
    items,
    workflowTasks,
    router,
    refresh,
    showToast,
    role,
    isItemOpening,
  ]);

  const queuePanel = (
        <OperationalPanel
          className={cn(
            "min-h-0 flex-1",
            hasRail ? undefined : "flex-none",
            "max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none",
          )}
        >
          {isFetched && items.length === 0 ? (
            <EmptyState
              line="لا توجد صكوك بانتظار البورصة"
              hint="عند تسجيل عقار جديد من إنفاذ دون إكمال بيانات البورصة، يظهر هنا تلقائياً."
            />
          ) : (
            <>
              <div className="pb-3 lg:hidden">
                <ActiveQueueMobileCards
                  items={mobileCardItems}
                  pending={queuePending}
                  emptyMessage="لا توجد صكوك بانتظار البورصة"
                />
              </div>
              <TableFrame className="hidden lg:block">
                <Table pending={queuePending}>
                  <THead>
                    <Tr hoverable={false}>
                      <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                      <Th>تاريخ الصك</Th>
                      <Th>أمر العمل</Th>
                      <Th>رقم الطلب</Th>
                      <Th>المالك</Th>
                      <Th>الاستحقاق</Th>
                      <ThAction aria-label="المزيد" />
                    </Tr>
                  </THead>
                  <TBody>
                    {queuePending && items.length === 0 ? (
                      <SkeletonTableRows rows={5} cols={7} />
                    ) : (
                      items.map((item) => {
                      const active =
                        selected?.poNumber === item.poNumber &&
                        selected?.propertyId === item.propertyId;
                      const deedLabel = formatPendingBourseDeedDisplay(item);
                      const task = caseStudyTaskForProperty(
                        item.poNumber,
                        item.propertyId,
                        workflowTasks,
                      );
                      const moreItems = task
                        ? buildBourseQueueRowMoreItems({
                            task,
                            propertyId: item.propertyId,
                            openTask: () => void openItem(item),
                            router,
                            refreshQueue: () => {
                              void refresh();
                            },
                            showToast,
                            allowDeleteTransaction: true,
                            viewerRole: role,
                          })
                        : [
                            {
                              id: "open",
                              label: "فتح المعاملة",
                              onClick: () => void openItem(item),
                            },
                            {
                              id: "property-detail",
                              label: "تفاصيل العقار",
                              onClick: () =>
                                router.push(
                                  poPropertyPath(item.poNumber, item.propertyId),
                                ),
                            },
                          ];

                      return (
                        <Tr
                          key={`${item.poNumber}-${item.propertyId}`}
                          hoverable={false}
                          className={cn(
                            "group/atq-row",
                            ROW,
                            active && ROW_ACTIVE,
                            isItemOpening(item) &&
                              "ui-queue-row-opening pointer-events-none",
                          )}
                          onClick={() => void openItem(item)}
                        >
                          <Td>
                            <InteractiveDeedCell
                              label={deedLabel}
                              loading={isItemOpening(item)}
                            />
                          </Td>
                          <TdLtr className="text-text-2">
                            {item.deedDate?.trim()
                              ? formatDateAr(item.deedDate)
                              : "—"}
                          </TdLtr>
                          <Td className="text-text-2">
                            <PoNumber
                              value={item.poNumber}
                              link
                              className="!text-[12.5px] !font-semibold text-text-2"
                            />
                          </Td>
                          <TdLtr
                            className="text-text-2"
                            valueClassName="text-[12.5px] font-semibold text-primary"
                          >
                            {item.requestNumber?.trim() || "—"}
                          </TdLtr>
                          <Td className="text-text-2">
                            {item.ownerName || "—"}
                          </Td>
                          <TdLtr className="text-text-2">
                            {formatDateAr(item.dueDateAt)}
                          </TdLtr>
                          <TdAction>
                            <RowMoreMenu items={moreItems} />
                          </TdAction>
                        </Tr>
                      );
                    })
                    )}
                  </TBody>
                </Table>
                <QueueTableHint className="border-t border-border bg-surface-2">
                  اضغط الصف لفتح نموذج إكمال البورصة.
                </QueueTableHint>
              </TableFrame>
            </>
          )}
        </OperationalPanel>
  );

  const sidePanel = hasRail ? (
        selected ? (
          <OperationalPanel className="flex h-full min-h-0 min-w-0 flex-1 flex-col !overflow-hidden">
            <div
              key={`${selected.poNumber}-${selected.propertyId}`}
              className="ui-queue-panel-in flex h-full min-h-0 min-w-0 flex-1 flex-col"
            >
            <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-none bg-transparent shadow-none">
            <CardBody className="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0 pt-3">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
                {formError ? (
                  <Note tone="warn" className="mb-3">
                    {formError}
                  </Note>
                ) : null}

                <RegistrationFormCard>
                  <PoPropertyBourseForm
                    property={property}
                    fieldErrors={fieldErrors}
                    onPatch={patchProperty}
                    poNumber={selected.poNumber}
                    showIntroNote={false}
                    showDeedVitalityFlow
                    deedVitality={deedVitality}
                    onDeedVitalityChange={setDeedVitality}
                    obstructionReason={obstructionReason}
                    onObstructionReasonChange={(v) => {
                      setObstructionReason(v);
                      setObstructionReasonError(undefined);
                    }}
                    obstructionReasonError={obstructionReasonError}
                  />
                </RegistrationFormCard>
              </div>

              <div className="shrink-0 border-t border-border bg-surface px-4 py-4 shadow-[0_-4px_16px_rgba(15,52,96,0.08)]">
                {/** Keep the toast action label unchanged, but render a simpler visible label for cleaner RTL centering. */}
                <Button
                  type="button"
                  variant="primary"
                  loading={saving}
                  disabled={saving}
                  showActionToast={false}
                  className="min-h-10 leading-tight"
                  actionLabel={
                    obstructionPath
                      ? "إرسال للمشرف — إدارة التعذرات"
                      : "حفظ وإكمال البورصة"
                  }
                  onClick={() => void handleSubmit()}
                >
                  {obstructionPath
                    ? "إرسال للمشرف - إدارة التعذرات"
                    : "حفظ وإكمال البورصة"}
                </Button>
              </div>
            </CardBody>
          </Card>
            </div>
          </OperationalPanel>
        ) : (
          <OperationalPanel className="flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center !overflow-hidden">
            <div className="max-w-[280px] px-4 py-7 text-center sm:px-6">
              <div
                className="mx-auto mb-3.5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-primary"
                aria-hidden
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className="m-0 mb-2 text-sm font-bold text-text">
                اختر صكاً من القائمة
              </h3>
              <p className="m-0 mb-4 text-xs leading-relaxed text-text-3">
                يفتح نموذج إكمال بيانات البورصة هنا — المدينة، الحي، والحدود.
              </p>
              <ul className="m-0 list-none p-0 text-end text-[11px] leading-loose text-text-2">
                <li className="border-b border-border py-1">
                  1 — اختر صفاً من قائمة الانتظار
                </li>
                <li className="border-b border-border py-1">
                  2 — أكمل حقول البورصة
                </li>
                <li className="py-1">3 — احفظ لإزالة الصك من القائمة</li>
              </ul>
            </div>
          </OperationalPanel>
        )
      ) : null;

  return (
    <ActiveTransactionPageLayout
      pageId="bourse-inquiry"
      hasRail={hasRail}
      panelOpen={panelOpen}
      reserveRail={hasRail}
      queuePanel={queuePanel}
      sidePanel={sidePanel}
    />
  );
}
