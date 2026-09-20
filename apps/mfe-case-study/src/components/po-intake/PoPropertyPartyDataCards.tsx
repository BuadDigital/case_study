"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPartyTaskSubmission,
  isPersistedPartyTaskSubmission,
  savePartyTaskSubmission,
  type PartyFieldProvenanceEntry,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import {
  RegField,
  RegSelect,
  RegTextarea,
} from "@platform/app-shared/registration/FormFields";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  InlineLoadingSkeleton,
  Note,
  useToast,
} from "@platform/ui-kit";
import { partyChildTaskForProperty } from "../../lib/app-data/documentary-workflow-gates";
import {
  PARTY_DATA_SECTIONS,
  applyPartyFieldEdits,
  partyOptionLabel,
  partyProvenanceLines,
  partyValueText,
  readPartyPayloadValue,
  type PartyDataSectionDef,
  type PartyFieldDef,
} from "../../lib/app-data/property-party-fields";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import { resolveApiError, workOrdersApiConfig } from "../../lib/work-orders-api-config";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

type Edits = Record<string, string | boolean>;

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مُرسَل",
  reopened: "أُعيد للتصحيح",
};

/** Survey / appraisal drafts belong to their party; staff correct those once submitted. */
function canStaffEdit(kind: PartyDataSectionDef["kind"], status: string): boolean {
  return kind === "field-inspection" || status === "submitted";
}

function ProvenanceLine({
  entry,
}: {
  entry: PartyFieldProvenanceEntry | undefined;
}) {
  const { written, edited } = partyProvenanceLines(entry);
  if (!written && !edited) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[10px] leading-4 text-text-3">
      {written ? <span>{written}</span> : null}
      {edited ? <span className="font-semibold text-text-2">{edited}</span> : null}
    </div>
  );
}

function PartyFieldRow({
  idPrefix,
  def,
  payload,
  edits,
  editable,
  provenance,
  onEdit,
}: {
  idPrefix: string;
  def: PartyFieldDef;
  payload: Record<string, unknown>;
  edits: Edits;
  editable: boolean;
  provenance: PartyFieldProvenanceEntry | undefined;
  onEdit: (key: string, value: string | boolean) => void;
}) {
  const id = `${idPrefix}-${def.key.replace(/\./g, "-")}`;
  const original = readPartyPayloadValue(payload, def.key);
  const edited = def.key in edits ? edits[def.key] : undefined;
  const textValue =
    typeof edited === "string" ? edited : partyValueText(original);
  const locked = !editable || def.input === "readonly";
  const wide = def.input === "textarea";

  let control;
  if (def.input === "checkbox") {
    const checked = typeof edited === "boolean" ? edited : original === true;
    control = (
      <label className="flex items-center gap-2 py-2 text-sm text-text-1">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(e) => onEdit(def.key, e.target.checked)}
        />
        {def.label}
      </label>
    );
  } else if (def.input === "select" && !locked) {
    control = (
      <RegSelect
        id={id}
        label={def.label}
        placeholder="—"
        value={textValue}
        options={(def.options ?? []).map((o) => ({
          value: o,
          label: partyOptionLabel(def.key, o),
        }))}
        onChange={(v) => onEdit(def.key, v)}
      />
    );
  } else if (def.input === "textarea" && !locked) {
    control = (
      <RegTextarea
        id={id}
        label={def.label}
        value={textValue}
        onChange={(v) => onEdit(def.key, v)}
      />
    );
  } else {
    control = (
      <RegField
        id={id}
        label={def.label}
        value={
          def.input === "select" ? partyOptionLabel(def.key, textValue) : textValue
        }
        dir={def.ltr ? "ltr" : undefined}
        readOnly={locked}
        onChange={locked ? undefined : (v) => onEdit(def.key, v)}
      />
    );
  }

  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      {control}
      <ProvenanceLine entry={provenance} />
    </div>
  );
}

function PartyDataCard({
  section,
  task,
  poNumber,
  canEdit,
}: {
  section: PartyDataSectionDef;
  task: WorkflowTask | null;
  poNumber: string;
  canEdit: boolean;
}) {
  const { showToast } = useToast();
  const [dto, setDto] = useState<PartyTaskSubmissionDto | null>(null);
  const [loading, setLoading] = useState(Boolean(task));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const taskId = task?.id ?? "";

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const config = workOrdersApiConfig();
    if (!config) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getPartyTaskSubmission(config, taskId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setDto(res.data);
        setLoadError(null);
      } else if (res.kind !== "not_found") {
        setLoadError(
          resolveApiError(res.kind, undefined, `تعذّر تحميل ${section.title}`),
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, section.title]);

  const onEdit = useCallback((key: string, value: string | boolean) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    setSaveError(null);
  }, []);

  const persisted = isPersistedPartyTaskSubmission(dto);
  const status = dto?.status ?? "draft";
  const editable = canEdit && persisted && canStaffEdit(section.kind, status);
  const dirtyCount = Object.keys(edits).length;

  const visibleFields = useMemo(() => {
    if (!dto) return [];
    return section.fields.filter(
      (f) =>
        f.input !== "readonly" ||
        partyValueText(readPartyPayloadValue(dto.payload, f.key)) !== "",
    );
  }, [dto, section.fields]);

  async function handleSave() {
    const config = workOrdersApiConfig();
    if (!config || !taskId || dirtyCount === 0) return;
    setSaving(true);
    setSaveError(null);
    // Re-read first so the edit lands on the party's latest payload, not a stale copy.
    const latest = await getPartyTaskSubmission(config, taskId);
    const base = latest.ok ? latest.data.payload : (dto?.payload ?? {});
    const result = await savePartyTaskSubmission(
      config,
      taskId,
      applyPartyFieldEdits(base, edits),
    );
    setSaving(false);
    if (!result.ok) {
      const message = resolveApiError(
        result.kind,
        result.errors,
        `تعذّر حفظ ${section.title}`,
      );
      setSaveError(message);
      showToast(message, "error");
      return;
    }
    setDto(result.data);
    setEdits({});
    showToast(`تم حفظ ${section.title}.`, "success");
  }

  let body;
  if (!task) {
    body = <Note tone="info">لم يُعيَّن {section.roleLabel} لهذا العقار بعد.</Note>;
  } else if (loading) {
    body = <InlineLoadingSkeleton />;
  } else if (loadError) {
    body = <Note tone="warn">{loadError}</Note>;
  } else if (!persisted || !dto) {
    body = <Note tone="info">لم يبدأ {section.roleLabel} عمله بعد.</Note>;
  } else {
    body = (
      <>
        {canEdit && !editable ? (
          <Note tone="info" className="mb-3">
            يمكن تعديل هذه البيانات بعد أن يُرسل {section.roleLabel} عمله؛ تظهر
            الآن للقراءة فقط.
          </Note>
        ) : null}
        {saveError ? (
          <Note tone="warn" className="mb-3">
            {saveError}
          </Note>
        ) : null}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFields.map((def) => (
            <PartyFieldRow
              key={def.key}
              idPrefix={`${section.kind}-${poNumber}`}
              def={def}
              payload={dto.payload}
              edits={edits}
              editable={editable}
              provenance={dto.fieldProvenance?.[def.key]}
              onEdit={onEdit}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold">{section.title}</h2>
            <p className="m-0 mt-0.5 text-xs text-text-3">
              {section.roleLabel}
              {persisted ? ` · ${STATUS_LABELS[status] ?? status}` : ""}
              {" — مع اسم من كتب كل معلومة ومن عدّلها"}
            </p>
          </div>
          {editable ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving || dirtyCount === 0}
              showActionToast={false}
              onClick={() => void handleSave()}
            >
              {dirtyCount > 0 ? `حفظ (${dirtyCount})` : "حفظ"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
}

/**
 * «تعديل العقار» — everything the inspector, the engineering office and the appraiser entered,
 * editable by case staff, with who wrote each value and who last edited it.
 */
export function PoPropertyPartyDataCards({
  poNumber,
  propertyId,
  canEdit,
}: {
  poNumber: string;
  propertyId: string;
  canEdit: boolean;
}) {
  const { data: tasks = [] } = useWorkflowTasksQuery();
  return (
    <>
      {PARTY_DATA_SECTIONS.map((section) => (
        <PartyDataCard
          key={section.kind}
          section={section}
          task={partyChildTaskForProperty(section.kind, poNumber, propertyId, tasks)}
          poNumber={poNumber}
          canEdit={canEdit}
        />
      ))}
    </>
  );
}
