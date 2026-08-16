"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDateAr,
  type AssignmentType,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";
import { updatePoRecord } from "../../lib/prototype/po-intake-storage";
import { RegField, RegSelect, RegTextarea } from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import {
  collectRequiredErrors,
  hasFieldErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import {
  firstPoHeaderErrorMessage,
  PO_HEADER_EDIT_FIELD_IDS,
  scheduleScrollToFirstPoHeaderError,
} from "../../lib/domain/po-intake/po-field-error-targets";
import { Label, Note } from "@platform/design-system";
import { listClients, type ClientDto } from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import { AssignmentTypeFields } from "./AssignmentTypeFields";
import { PoEditShell } from "./PoEditShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CountDisplay({
  label,
  value,
  unit,
  tag,
}: {
  label: string;
  value: string;
  unit?: string;
  tag?: string;
}) {
  return (
    <div className="col-span-full sm:col-span-2">
      <Label className="text-[11px]">{label}</Label>
      <div className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3 py-2 text-xs text-text-2">
        <span className="text-[15px] font-bold leading-none text-primary tabular-nums">
          {value}
        </span>
        {unit ? <span className="text-xs text-text-2">{unit}</span> : null}
        {tag ? (
          <span className="ms-auto whitespace-nowrap rounded-[10px] bg-info-bg px-2.5 py-0.5 text-[10px] font-semibold text-info-text">
            {tag}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function PoHeaderEdit({
  record,
  onBackAction,
  onSavedAction,
}: {
  record: PoIntakeRecord;
  onBackAction: () => void;
  onSavedAction: () => void;
}) {
  const [assignmentType, setAssignmentType] = useState(record.assignmentType);
  const [promulgationDate, setPromulgationDate] = useState(
    record.promulgationDate || record.receivedFromEnfathAt,
  );
  const [assignmentSpecialist, setAssignmentSpecialist] = useState(
    record.assignmentSpecialist,
  );
  const [assignmentSpecialistEmail, setAssignmentSpecialistEmail] = useState(
    record.assignmentSpecialistEmail,
  );
  const [expectedPropertyCount, setExpectedPropertyCount] = useState(
    String(record.expectedPropertyCount ?? 1),
  );
  const [workOrderDescription, setWorkOrderDescription] = useState(
    record.workOrderDescription ?? "",
  );
  const [clientId, setClientId] = useState(record.clientId ?? "");
  const [reportUserClientIds, setReportUserClientIds] = useState<string[]>(
    record.reportUserClientIds ?? [],
  );
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const config = workOrdersApiConfig();
    if (!config) {
      setClientsLoading(false);
      return;
    }
    void listClients(config, true).then((res) => {
      setClientsLoading(false);
      if (!res.ok) return;
      setClients(res.data);
    });
  }, []);

  const receivedDisplay = useMemo(
    () => formatDateAr(record.receivedFromEnfathAt),
    [record.receivedFromEnfathAt],
  );
  const dueDisplay = useMemo(
    () => formatDateAr(record.dueDateAt),
    [record.dueDateAt],
  );

  const isDirty =
    assignmentType !== record.assignmentType ||
    promulgationDate !== (record.promulgationDate || record.receivedFromEnfathAt) ||
    assignmentSpecialist.trim() !== record.assignmentSpecialist ||
    assignmentSpecialistEmail.trim() !== record.assignmentSpecialistEmail ||
    workOrderDescription.trim() !== (record.workOrderDescription ?? "").trim() ||
    clientId !== (record.clientId ?? "") ||
    reportUserClientIds.join(",") !== (record.reportUserClientIds ?? []).join(",") ||
    Math.max(1, parseInt(expectedPropertyCount, 10) || 1) !==
      (record.expectedPropertyCount ?? 1);

  async function handleSave() {
    const errors = mergeFieldErrors(
      collectRequiredErrors(
        {
          assignmentType,
          promulgationDate,
          clientId,
        },
        ["assignmentType", "promulgationDate", "clientId"],
      ),
    );
    if (
      assignmentSpecialistEmail.trim() &&
      !EMAIL_RE.test(assignmentSpecialistEmail.trim())
    ) {
      errors.assignmentSpecialistEmail = "صيغة الإيميل غير صالحة";
    }
    const count = parseInt(expectedPropertyCount, 10);
    if (!Number.isFinite(count) || count < 1) {
      errors.expectedPropertyCount = "عدد العقارات يجب أن يكون 1 على الأقل";
    }
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstPoHeaderErrorMessage(errors));
      scheduleScrollToFirstPoHeaderError(errors, PO_HEADER_EDIT_FIELD_IDS);
      return;
    }

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const clientNameAr = clients.find((c) => c.id === clientId)?.nameAr;
    const next: PoIntakeRecord = {
      ...record,
      assignmentType: assignmentType as AssignmentType,
      promulgationDate,
      assignmentSpecialist: assignmentSpecialist.trim(),
      assignmentSpecialistEmail: assignmentSpecialistEmail.trim(),
      expectedPropertyCount: Math.max(1, count || 1),
      workOrderDescription: workOrderDescription.trim(),
      clientId: clientId.trim(),
      reportUserClientIds,
      clientNameAr,
    };

    const result = await updatePoRecord(next);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.errors) setFieldErrors(result.errors);
      return;
    }

    onSavedAction();
  }

  return (
    <PoEditShell
      title={`تعديل أمر العمل — ${record.poNumber}`}
      subtitle="المشرف — بيانات PO فقط (العقارات يعدّلها الأخصائي)"
      isDirty={isDirty}
      saving={saving}
      onBack={onBackAction}
      onSave={() => void handleSave()}
    >
      {formError ? <Note tone="warn">{formError}</Note> : null}

      <RegistrationFormCard title="بيانات أمر العمل">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RegField
            id="po_number_ro"
            label="رقم PO (التعميد)"
            value={record.poNumber}
            dir="ltr"
            readOnly
          />
          <RegField
            id="promulgation_edit"
            label="تاريخ التعميد"
            required
            type="date"
            value={promulgationDate}
            error={fieldErrors.promulgationDate}
            onChange={setPromulgationDate}
          />
          <RegSelect
            id="po_client_edit"
            label="العميل"
            required
            value={clientId}
            error={fieldErrors.clientId}
            disabled={clientsLoading}
            placeholder={clientsLoading ? "جاري التحميل…" : "اختر العميل"}
            options={clients
              .filter((c) => c.isActive || c.id === clientId)
              .map((c) => ({
                value: c.id,
                label: c.isActive ? c.nameAr : `${c.nameAr} (معطّل)`,
              }))}
            onChange={setClientId}
          />
          <div>
            <p className="mb-1 text-[11px] font-semibold text-text-2">
              مستخدمو التقرير (0..ن) — من سجل العملاء
            </p>
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-border-md bg-surface px-2 py-1.5">
              {clients
                .filter((c) => c.isActive || reportUserClientIds.includes(c.id))
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-1.5 text-[12px] text-text-2"
                  >
                    <input
                      type="checkbox"
                      checked={reportUserClientIds.includes(c.id)}
                      onChange={(e) =>
                        setReportUserClientIds((prev) =>
                          e.target.checked
                            ? [...prev, c.id]
                            : prev.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.nameAr}
                    {c.id === clientId ? " (العميل نفسه)" : ""}
                  </label>
                ))}
              {clients.length === 0 && !clientsLoading ? (
                <span className="text-[11px] text-text-3">لا عملاء مسجلين</span>
              ) : null}
            </div>
            <p className="mt-1 text-[10.5px] text-text-3">
              بلا اختيار: التقرير للعميل وحده — وتشتق جملة حصر الاستخدام تلقائيًا.
            </p>
          </div>
          <AssignmentTypeFields
            value={assignmentType}
            error={fieldErrors.assignmentType}
            onChange={(v) => setAssignmentType(v)}
          />
          <RegField
            id="po_specialist_edit"
            label="اسم أخصائي الإسناد"
            value={assignmentSpecialist}
            error={fieldErrors.assignmentSpecialist}
            onChange={setAssignmentSpecialist}
          />
          <RegField
            id="po_specialist_email_edit"
            label="إيميل أخصائي الإسناد"
            type="email"
            dir="ltr"
            value={assignmentSpecialistEmail}
            error={fieldErrors.assignmentSpecialistEmail}
            onChange={setAssignmentSpecialistEmail}
          />
          <RegField
            id="expected_property_count_edit"
            label="عدد العقارات"
            required
            type="number"
            dir="ltr"
            value={expectedPropertyCount}
            error={fieldErrors.expectedPropertyCount}
            onChange={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 3);
              setExpectedPropertyCount(digits || "");
            }}
          />
          <div className="col-span-full">
            <RegTextarea
              id="work_order_description_edit"
              label="وصف أمر العمل"
              value={workOrderDescription}
              onChange={setWorkOrderDescription}
              rows={3}
            />
          </div>
          <CountDisplay
            label="تاريخ الاستلام الفعلي"
            value={receivedDisplay}
            tag="بعد الحفظ"
          />
          <CountDisplay
            label="تاريخ الاستحقاق"
            value={dueDisplay}
            tag="محسوب"
          />
          <CountDisplay
            label="عدد العقارات"
            value={String(record.properties.length)}
            unit="عقارات"
          />
        </div>
        <p className="mt-2 text-[11px] text-text-3">
          رقم PO غير قابل للتعديل بعد الحفظ الأول.
        </p>
      </RegistrationFormCard>
    </PoEditShell>
  );
}
