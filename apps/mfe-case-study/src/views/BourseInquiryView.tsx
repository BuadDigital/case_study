"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Note,
  OperationalPanel,
  PageShellHeader,
  PageToolbar,
  QueueTableHint,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableRowActiveClassName,
  queueTableRowClassName,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { ROLES } from "@platform/app-shared/prototype/constants";
import {
  submitBourseObstruction,
  validateBourseObstructionReason,
} from "../lib/prototype/bourse-obstruction";
import type { BourseDeedVitality } from "../lib/prototype/po-intake-data";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import {
  emptyProperty,
  formatDateAr,
  formatPendingBourseDeedDisplay,
  formatPoDisplay,
  type PoPropertyIntake,
} from "../lib/prototype/po-intake-data";
import {
  completePropertyBourse,
  findPropertyInRecord,
} from "../lib/prototype/po-intake-storage";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { usePendingBourseItemsQuery } from "../query/case-study-queries";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  hasFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import { PoPropertyBourseForm } from "@case-study/mfe/components/po-intake/PoPropertyBourseForm";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "@case-study/mfe/components/po-intake/po-property-bourse-validation";
import type { PendingBoursePropertyDto } from "@platform/api-client";

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;

export function BourseInquiryView() {
  const { role } = usePrototype();
  const queryClient = useQueryClient();
  const {
    data: rawItems = [],
    isFetched,
    refetch,
  } = usePendingBourseItemsQuery();
  const { data: failures = [] } = useFailuresQuery();

  const items = rawItems.filter((item) => {
    const failure = failures.find(
      (f) =>
        f.poNumber === item.poNumber && f.propertyId === item.propertyId,
    );
    return (
      !failure ||
      failure.status === "returned" ||
      failure.status === "resolved"
    );
  });
  const queuePending = !isFetched;
  const { showToast } = useToast();
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

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: prototypeKeys.pendingBourseItems(),
    });
    await refetch();
  }, [queryClient, refetch]);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        const next = { ...p, [key]: value };
        if (key === "classification") next.propertyType = "";
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
        taskNumber: item.taskNumber ?? "",
      });
    }
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
        return;
      }

      setSaving(true);
      setFormError(null);
      setObstructionReasonError(undefined);
      await submitBourseObstruction({
        poNumber: selected.poNumber,
        propertyId: selected.propertyId,
        deedNumber: property.deedNumber || selected.deedNumber,
        reason: obstructionReason,
        specialist: ROLES[role]?.name ?? "أخصائي دراسة الحالة",
      });
      setSaving(false);
      closeForm();
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.failures() });
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.workflowTasks(),
      });
      await refresh();
      showToast("تم إرسال التعذر للمشرف.", "success");
      return;
    }

    const errors = validatePropertyBourseFields(property);
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstBourseValidationMessage(errors));
      return;
    }

    setSaving(true);
    setFormError(null);
    const result = await completePropertyBourse(
      selected.poNumber,
      selected.propertyId,
      { ...property, deedStatus: "فعال" },
    );
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.errors) setFieldErrors(result.errors);
      showToast(result.error, "error");
      return;
    }

    closeForm();
    await refresh();
    showToast("تم حفظ بيانات البورصة.", "success");
  }

  const obstructionPath = deedVitality === "inactive";

  const showSplit = !!selected || (isFetched && items.length > 0);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
      <div
        className={cn(
          "grid min-h-0 flex-1 items-stretch gap-3 bg-bg px-4 py-4 sm:py-5",
          showSplit
            ? "grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
            : "grid-cols-1",
        )}
      >
        <OperationalPanel className={cn(showSplit ? "min-h-0 flex-1" : "flex-none")}>
          <PageShellHeader
            hideTitle
            title="استعلام بورصة"
            actions={
              <Button
                type="button"
                size="sm"
                variant="default"
                className="shrink-0"
                disabled={queuePending}
                onClick={() => void refresh()}
              >
                تحديث
              </Button>
            }
          />

          <PageToolbar className="border-b-0 bg-surface-2/50">
            <Note tone="info" className="m-0 flex-1">
              <strong>مسار العمل:</strong> اختر صكاً من قائمة الانتظار، أكمل المدينة
              والتصنيف ونوع العقار وبيانات الحدود من البورصة، ثم احفظ — يُزال الصك
              من القائمة ويُحدَّث في شاشة العقارات.
            </Note>
          </PageToolbar>

          {isFetched && items.length === 0 ? (
            <EmptyState
              line="لا توجد صكوك بانتظار البورصة"
              hint="عند تسجيل عقار جديد من إنفاذ دون إكمال بيانات البورصة، يظهر هنا تلقائياً."
            />
          ) : (
            <>
              <div className={queueTableWrapClassName}>
                <Table pending={queuePending}>
                  <THead>
                    <Tr hoverable={false}>
                      <Th>رقم الصك</Th>
                      <Th>تاريخ الصك</Th>
                      <Th>أمر العمل</Th>
                      <Th>رقم المهمة</Th>
                      <Th>المالك</Th>
                      <Th>الاستحقاق</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {queuePending && items.length === 0 ? (
                      <SkeletonTableRows rows={5} cols={6} />
                    ) : (
                      items.map((item) => {
                      const active =
                        selected?.poNumber === item.poNumber &&
                        selected?.propertyId === item.propertyId;
                      const deedLabel = formatPendingBourseDeedDisplay(item);

                      return (
                        <Tr
                          key={`${item.poNumber}-${item.propertyId}`}
                          hoverable={false}
                          className={cn(ROW, active && ROW_ACTIVE)}
                          onClick={() => void openItem(item)}
                        >
                          <Td>
                            <span
                              dir="ltr"
                              className="inline-block text-[11px] font-semibold text-primary"
                            >
                              {deedLabel}
                            </span>
                          </Td>
                          <Td className="text-text-2">
                            {item.deedDate?.trim()
                              ? formatDateAr(item.deedDate)
                              : "—"}
                          </Td>
                          <Td className="text-text-2">
                            <PoNumber value={item.poNumber} link />
                          </Td>
                          <Td className="text-text-2">
                            <span
                              dir="ltr"
                              className="inline-block text-[11px] font-semibold text-primary"
                            >
                              {item.taskNumber?.trim() || "—"}
                            </span>
                          </Td>
                          <Td className="text-text-2">
                            {item.ownerName || "—"}
                          </Td>
                          <Td className="text-text-2">
                            {formatDateAr(item.dueDateAt)}
                          </Td>
                        </Tr>
                      );
                    })
                    )}
                  </TBody>
                </Table>
              </div>
              <QueueTableHint>
                اضغط الصف لفتح نموذج إكمال البورصة.
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>

        {selected ? (
          <OperationalPanel className="flex max-h-none flex-col self-start max-lg:static max-lg:max-h-none lg:sticky lg:top-3 lg:max-h-[calc(100dvh-5.5rem)]">
            <Card className="flex max-h-none flex-col overflow-hidden rounded-none border-none bg-transparent shadow-none">
            <CardHeader className="shrink-0 px-4 py-3">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                بيانات البورصة
                <span
                  className="rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-primary"
                  dir="ltr"
                >
                  {formatPendingBourseDeedDisplay(selected)}
                </span>
              </span>
              <Button type="button" size="sm" variant="default" onClick={closeForm}>
                إغلاق
              </Button>
            </CardHeader>
            <CardBody className="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
                <div className="mb-3.5 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-text-2">
                  <span>
                    أمر العمل:{" "}
                    <strong dir="ltr">{formatPoDisplay(selected.poNumber)}</strong>
                  </span>
                  {selected.ownerName ? (
                    <span>
                      المالك: <strong>{selected.ownerName}</strong>
                    </span>
                  ) : null}
                </div>

                {formError ? (
                  <Note tone="warn" className="mb-3">
                    {formError}
                  </Note>
                ) : null}

                <RegistrationFormCard
                  title="بيانات البورصة"
                  subtitle="المدينة · التصنيف · نوع العقار · الحدود"
                >
                  <PoPropertyBourseForm
                    property={property}
                    fieldErrors={fieldErrors}
                    onPatch={patchProperty}
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
                <Button
                  type="button"
                  variant="primary"
                  loading={saving}
                  disabled={saving}
                  onClick={() => void handleSubmit()}
                >
                  {obstructionPath
                    ? "إرسال للمشرف — إدارة التعذرات"
                    : "حفظ وإكمال البورصة"}
                </Button>
              </div>
            </CardBody>
          </Card>
          </OperationalPanel>
        ) : items.length > 0 ? (
          <OperationalPanel className="hidden min-h-[280px] items-center justify-center lg:flex">
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
                يفتح نموذج إكمال بيانات البورصة هنا — المدينة، التصنيف، نوع
                العقار، والحدود.
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
        ) : null}
      </div>
    </div>
  );
}
