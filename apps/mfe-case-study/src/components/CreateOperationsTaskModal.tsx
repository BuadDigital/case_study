"use client";

import { useEffect, useMemo, useState } from "react";
import { Note, Spinner, cn } from "@platform/ui-kit";
import {
  fetchPartyFeePricingById,
  fetchPartyFeePricingTables,
  type CreateOperationsTaskRequest,
  type OperationsTaskLetterRowDto,
} from "@platform/api-client";
import { pad2 } from "@platform/app-shared/format/date";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { AppModal } from "./ui/AppModal";
import {
  type DistributionAssignee,
} from "../lib/prototype/distribution-parties";
import {
  assigneesForOperationsTaskType,
  groupAssigneesForSelect,
} from "../lib/prototype/operations-task-assignees";
import {
  formatPropertyDeedDisplay,
  showsCourtFields,
  type PoIntakeRecord,
} from "../lib/prototype/po-intake-data";
import {
  OPERATIONS_TASK_PRIORITY_LABELS,
  OPERATIONS_TASK_SCOPE_LABELS,
  OPERATIONS_TASK_TYPE_LABELS,
} from "../lib/prototype/operations-task-display";
import { createOperationsTaskRecord } from "../lib/prototype/operations-tasks-storage";
import { LetterTable } from "../views/OperationsTasksViewParts";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFldTextarea,
  opsFormGrid,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsFileSize,
  opsTfChip,
  opsTfChipActive,
  opsTfDeed,
  opsTfDeedCheck,
  opsTfDeeds,
  opsTfLblInFld,
  opsTfNote,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/prototype/ops-tasks-tw";

const TASK_TYPES = ["general", "court_visit"] as const;

/** Unified link scope for court visit and general task (includes general). */
const LINK_SCOPES = ["work_order", "transaction", "multi", "general"] as const;

const PRIORITY_OFFSET_MS: Record<string, number> = {
  high: 4 * 3_600_000,
  medium: 12 * 3_600_000,
  low: 24 * 3_600_000,
};

const DEFAULT_TITLES: Record<string, string> = {
  court_visit: "زيارة محكمة",
  general: "مهمة عامة",
};

function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function SegRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={opsTfSegRow}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? opsTfSegActive : opsTfSeg}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export type CreateOperationsTaskPrefill = {
  type?: string;
  scope?: string;
  poNumber?: string;
  deed?: string;
  title?: string;
};

function buildLetterRowsForPo(record: PoIntakeRecord): OperationsTaskLetterRowDto[] {
  return record.properties
    .filter((p) => !p.isRemoved && p.court.trim())
    .map((p) => ({
      po: record.poNumber.trim(),
      deed: formatPropertyDeedDisplay(p) || p.deedNumber.trim() || "—",
      owner: p.ownerName?.trim() || "—",
      request: p.requestNumber?.trim() || "—",
      court: p.court.trim(),
      circuit: p.circuit.trim() || "—",
    }));
}

/** One-deed rows for scope=transaction (must still carry court for court_visit). */
function buildLetterRowsForDeed(
  records: PoIntakeRecord[],
  poNumber: string,
  deed: string,
): OperationsTaskLetterRowDto[] {
  const po = poNumber.trim();
  const d = deed.trim();
  if (!po || !d) return [];
  return buildLetterRowsForDeeds(
    records.filter((r) => r.poNumber.trim() === po),
    [d],
  );
}

function buildLetterRowsForDeeds(
  records: PoIntakeRecord[],
  selectedDeeds: string[],
): OperationsTaskLetterRowDto[] {
  const want = new Set(selectedDeeds);
  const rows: OperationsTaskLetterRowDto[] = [];
  for (const record of records) {
    for (const row of buildLetterRowsForPo(record)) {
      if (want.has(row.deed)) rows.push(row);
    }
  }
  return rows;
}

function allDeedOptions(records: PoIntakeRecord[]): { deed: string; po: string }[] {
  const out: { deed: string; po: string }[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const p of record.properties) {
      if (p.isRemoved) continue;
      const deed = formatPropertyDeedDisplay(p) || p.deedNumber.trim();
      if (!deed || seen.has(deed)) continue;
      seen.add(deed);
      out.push({ deed, po: record.poNumber.trim() });
    }
  }
  return out;
}

function assigneesForType(
  type: string,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  return assigneesForOperationsTaskType(type, staffUsers);
}

function deedOptions(record: PoIntakeRecord | undefined): string[] {
  if (!record) return [];
  return record.properties
    .filter((p) => !p.isRemoved)
    .map((p) => formatPropertyDeedDisplay(p) || p.deedNumber.trim())
    .filter(Boolean);
}

type Props = {
  open: boolean;
  poRecords: PoIntakeRecord[];
  staffUsers: StaffUser[];
  staffLoadError?: string | null;
  prefill?: CreateOperationsTaskPrefill | null;
  /** true while staff / distribution queries are loading */
  staffLoading?: boolean;
  onClose: () => void;
  onCreated: (taskId: string) => void;
};

function prefillType(prefill: CreateOperationsTaskPrefill | null | undefined): string {
  const raw = prefill?.type?.trim() || "general";
  return (TASK_TYPES as readonly string[]).includes(raw) ? raw : "general";
}

function defaultDueFields(): { date: string; time: string } {
  const due = new Date(Date.now() + PRIORITY_OFFSET_MS.medium);
  return { date: toLocalDateValue(due), time: toLocalTimeValue(due) };
}

export function CreateOperationsTaskModal({
  open,
  poRecords,
  staffUsers,
  staffLoadError = null,
  prefill,
  staffLoading = false,
  onClose,
  onCreated,
}: Props) {
  if (!open) return null;
  const prefillKey = JSON.stringify([
    prefill?.type,
    prefill?.scope,
    prefill?.poNumber,
    prefill?.deed,
    prefill?.title,
  ]);
  return (
    <CreateOperationsTaskForm
      key={prefillKey}
      poRecords={poRecords}
      staffUsers={staffUsers}
      staffLoadError={staffLoadError}
      prefill={prefill}
      staffLoading={staffLoading}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function CreateOperationsTaskForm({
  poRecords,
  staffUsers,
  staffLoadError,
  prefill,
  staffLoading,
  onClose,
  onCreated,
}: Omit<Props, "open">) {
  const [due] = useState(defaultDueFields);
  const [type, setType] = useState(() => prefillType(prefill));
  const [scope, setScope] = useState(() => prefill?.scope?.trim() || "work_order");
  const [title, setTitle] = useState(
    () =>
      prefill?.title?.trim() || DEFAULT_TITLES[prefillType(prefill)] || "مهمة",
  );
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [poNumber, setPoNumber] = useState(() => prefill?.poNumber?.trim() || "");
  const [deed, setDeed] = useState(() => prefill?.deed?.trim() || "");
  const [selectedDeeds, setSelectedDeeds] = useState<string[]>(() => {
    const d = prefill?.deed?.trim();
    return d ? [d] : [];
  });
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [visitFeeAmountSar, setVisitFeeAmountSar] = useState("");
  const [dueDate, setDueDate] = useState(due.date);
  const [dueTime, setDueTime] = useState(due.time);
  const [dueChip, setDueChip] = useState<"today" | "tomorrow" | "after" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignees = useMemo(
    () => assigneesForType(type, staffUsers),
    [type, staffUsers],
  );

  const assigneeGroups = useMemo(
    () => groupAssigneesForSelect(assignees, staffUsers),
    [assignees, staffUsers],
  );

  const selectedAssigneeUser = useMemo(
    () =>
      staffUsers.find(
        (u) => u.distributionAssigneeId?.trim() === assigneeId.trim(),
      ),
    [staffUsers, assigneeId],
  );

 /** Cooperator reviewers need a create-time visit fee; employees do not. */
  const needsVisitFee =
    type === "court_visit" &&
    Boolean(assigneeId) &&
    selectedAssigneeUser?.type !== "internal";

  const poOptions = useMemo(() => {
    if (type === "court_visit") {
      return poRecords.filter((r) => showsCourtFields(r.assignmentType));
    }
    return poRecords;
  }, [poRecords, type]);

  const selectedPo = useMemo(
    () => poOptions.find((r) => r.poNumber.trim() === poNumber.trim()),
    [poOptions, poNumber],
  );

  const deeds = useMemo(() => deedOptions(selectedPo), [selectedPo]);

  const multiDeedOptions = useMemo(() => allDeedOptions(poOptions), [poOptions]);

  const letterPreview = useMemo(() => {
    if (type !== "court_visit") return [];
    if (scope === "multi" && selectedDeeds.length > 0) {
      return buildLetterRowsForDeeds(poOptions, selectedDeeds);
    }
    if (scope === "transaction" && poNumber.trim() && deed.trim()) {
      return buildLetterRowsForDeed(poOptions, poNumber, deed);
    }
    if (!selectedPo) return [];
    return buildLetterRowsForPo(selectedPo);
  }, [type, scope, selectedPo, selectedDeeds, poOptions, poNumber, deed]);

  const applyPriorityDue = (prio: string) => {
    setPriority(prio);
    const due = new Date(Date.now() + (PRIORITY_OFFSET_MS[prio] ?? PRIORITY_OFFSET_MS.medium));
    setDueDate(toLocalDateValue(due));
    setDueTime(toLocalTimeValue(due));
    setDueChip(null);
  };

  const applyDueChip = (chip: "today" | "tomorrow" | "after") => {
    const off = chip === "today" ? 0 : chip === "tomorrow" ? 1 : 2;
    const d = new Date();
    d.setDate(d.getDate() + off);
    setDueDate(toLocalDateValue(d));
    setDueChip(chip);
  };

  useEffect(() => {
    if (staffLoading) return;
    if (assignees.length === 0) {
      setAssigneeId("");
      setAssigneeName("");
      return;
    }
    const stillValid = assignees.some((a) => a.id === assigneeId);
    if (stillValid) return;
    const first = assignees[0]!;
    setAssigneeId(first.id);
    setAssigneeName(first.name);
  }, [assignees, assigneeId, staffLoading]);

  useEffect(() => {
    if (!needsVisitFee) {
      setVisitFeeAmountSar("");
      return;
    }

    let cancelled = false;
    const config = prototypeModulesApiConfig();
    if (!config) return;

    void (async () => {
      const tables = await fetchPartyFeePricingTables(config, "court-visit");
      if (!tables.ok || cancelled) return;
      const active = tables.data.find((t) => t.isActive) ?? tables.data[0];
      if (!active) return;
      const detail = await fetchPartyFeePricingById(config, active.id);
      if (!detail.ok || cancelled) return;
      const amount = detail.data.courtVisitFeeSar;
      if (typeof amount === "number" && amount > 0) {
        setVisitFeeAmountSar(String(amount));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsVisitFee, assigneeId]);

  const toggleDeed = (value: string) => {
    setSelectedDeeds((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  };

  const handleSubmit = async () => {
    // HTML `tfSubmit`: title defaults to TASK_TYPES[type].label (no title field).
    const trimmedTitle =
      (prefill?.title?.trim() || title.trim() || OPERATIONS_TASK_TYPE_LABELS[type] || "").trim();
    if (!type.trim()) {
      setError("نوع المهمة مطلوب");
      return;
    }
    if (!trimmedTitle) {
      setError("العنوان مطلوب");
      return;
    }
    if (!assigneeId.trim()) {
      setError("المنفّذ مطلوب");
      return;
    }

    let parsedVisitFee: number | undefined;
    if (needsVisitFee) {
      const raw = visitFeeAmountSar.trim();
      const amount = Number(raw.replace(/,/g, ""));
      if (!raw || !Number.isFinite(amount) || amount <= 0) {
        setError("مبلغ أتعاب الزيارة مطلوب للمتعاون");
        return;
      }
      parsedVisitFee = amount;
    }

    let deedsPayload: string[] | undefined;
    let poPayload: string | undefined;
    let letterRows: OperationsTaskLetterRowDto[] | undefined;

    if (scope === "work_order") {
      const po = poNumber.trim();
      if (!po) {
        setError("اختر أمر عمل");
        return;
      }
      poPayload = po;
      if (type === "court_visit") {
        if (!selectedPo || !showsCourtFields(selectedPo.assignmentType)) {
          setError("نوع الإسناد لا يتطلب محاكم");
          return;
        }
        letterRows = buildLetterRowsForPo(selectedPo);
        if (letterRows.length === 0) {
          setError("لا توجد عقارات بمحكمة مسجّلة");
          return;
        }
        deedsPayload = letterRows.map((r) => r.deed);
      } else {
        deedsPayload = deedOptions(selectedPo);
      }
    } else if (scope === "transaction") {
      const po = poNumber.trim();
      const d = deed.trim();
      if (!po || !d) {
        setError("اختر أمر عمل وصكاً واحداً");
        return;
      }
      poPayload = po;
      deedsPayload = [d];
      if (type === "court_visit") {
        letterRows = buildLetterRowsForDeed(poOptions, po, d);
        if (letterRows.length === 0) {
          setError(
            "هذا الصك بلا محكمة مسجّلة — لا يمكن إنشاء صف خطاب التفويض. أكمل بيانات المحكمة في العقار ثم أعد المحاولة.",
          );
          return;
        }
      }
    } else if (scope === "multi") {
      if (selectedDeeds.length < 2) {
        setError("اختر صكّين فأكثر");
        return;
      }
      deedsPayload = selectedDeeds;
      const firstPo =
        multiDeedOptions.find((d) => selectedDeeds.includes(d.deed))?.po ||
        poNumber.trim();
      poPayload = firstPo || undefined;
      if (type === "court_visit") {
        letterRows = buildLetterRowsForDeeds(poOptions, selectedDeeds);
        if (letterRows.length < 2) {
          setError("الصكوك المحددة يجب أن تحمل محكمة مسجّلة");
          return;
        }
      }
    }

    if (!dueDate.trim()) {
      setError("موعد الاستحقاق مطلوب");
      return;
    }

    const [y, mo, da] = dueDate.split("-").map(Number);
    const [hh, mm] = (dueTime || "12:00").split(":").map(Number);
    const dueAt = new Date(y!, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0);

    const body: CreateOperationsTaskRequest = {
      type,
      title: trimmedTitle,
      description: description.trim() || undefined,
      scope,
      poNumber: poPayload,
      deeds: deedsPayload,
      assigneeId: assigneeId.trim(),
      assigneeName: assigneeName.trim(),
      priority,
      dueAtUtc: dueAt.toISOString(),
      letterRows,
      visitFeeAmountSar: parsedVisitFee,
    };

    setBusy(true);
    setError(null);
    const result = await createOperationsTaskRecord(body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.task.id);
    onClose();
  };

  return (
    <AppModal
      open
      title="مهمة جديدة"
      subtitle="واجهة موحّدة للإنشاء والإسناد — «زيارة محكمة» يفعّل خطاب التفويض"
      onClose={onClose}
      wide
      maxWidthPx={720}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <button type="button" className={opsBtnGhost} onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button
            type="button"
            className={opsBtnPrimary}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void handleSubmit()}
          >
            {busy ? <Spinner /> : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            )}
            <span>{busy ? "جاري الإنشاء…" : "إنشاء المهمة"}</span>
          </button>
        </div>
      }
    >
      <div className={opsFormGrid}>
          {error ? (
            <div className={opsFldFull}>
              <Note tone="danger">{error}</Note>
            </div>
          ) : null}

          <div className={opsFld}>
            <label className={opsTfLblInFld}>نوع المهمة *</label>
            <select
              className={opsFldControl}
              value={type}
              onChange={(e) => {
                const next = e.target.value;
                setType(next);
                setTitle(DEFAULT_TITLES[next] ?? "مهمة");
              }}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {OPERATIONS_TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {type === "general" ? (
              <span className="mt-1 block text-[11px] leading-snug text-text-3">
                تكليف تشغيلي لأي طرف منفّذ: معاين، مقيم، مكتب هندسي، أو مراجع.
              </span>
            ) : type === "court_visit" ? (
              <span className="mt-1 block text-[11px] leading-snug text-text-3">
                زيارة محكمة — تُسند للمراجع الحكومي فقط (مع أتعاب الزيارة للمتعاون).
              </span>
            ) : null}
          </div>

          <div className={opsFld}>
            <label className={opsTfLblInFld}>مُسندة إلى *</label>
            <select
              className={opsFldControl}
              value={staffLoading ? "" : assigneeId}
              disabled={staffLoading || assignees.length === 0}
              onChange={(e) => {
                const id = e.target.value;
                setAssigneeId(id);
                setAssigneeName(assignees.find((a) => a.id === id)?.name ?? "");
              }}
            >
              {staffLoading ? (
                <option value="">جاري تحميل المنفّذين…</option>
              ) : (
                <>
                  <option value="">اختر المنفّذ…</option>
                  {assigneeGroups.length > 1
                    ? assigneeGroups.map((g) => (
                        <optgroup key={g.key} label={g.label}>
                          {g.items.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.subtitle ? ` — ${a.subtitle}` : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : assignees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.subtitle ? ` — ${a.subtitle}` : ""}
                        </option>
                      ))}
                </>
              )}
            </select>
            {staffLoading ? (
              <span className="mt-1 block text-[11px] text-text-3">
                جاري جلب قائمة المعاينين والمقيمين والمكاتب والمراجعين…
              </span>
            ) : assignees.length === 0 ? (
              <span className="text-[11px] text-text-3">
                {staffLoadError
                  ? staffLoadError
                  : staffUsers.length === 0
                    ? "تعذّر تحميل المنفّذين — تحقق من تسجيل الدخول وخادم الهوية (صلاحية manage-work-orders)."
                    : "لا يوجد منفّذون بمُعرّف توزيع لهذا النوع. تأكد أن للموظفين DistributionAssigneeId ودور طرف صحيح."}
              </span>
            ) : type === "general" ? (
              <span className="mt-1 block text-[11px] leading-snug text-text-3">
                {assignees.length} منفّذ متاح
                {assigneeGroups.length > 1
                  ? ` · ${assigneeGroups.map((g) => g.label).join(" · ")}`
                  : ""}
              </span>
            ) : null}
          </div>

          {type === "court_visit" && assigneeId && needsVisitFee ? (
            <div className={opsFld}>
              <label className={opsTfLblInFld}>أتعاب الزيارة (ر.س) *</label>
              <input
                className={opsFldControl}
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={visitFeeAmountSar}
                onChange={(e) => setVisitFeeAmountSar(e.target.value)}
                placeholder="المبلغ الافتراضي من جدول التسعير قابل للتعديل"
              />
              <span className="mt-1 block text-[11px] leading-snug text-text-3">
                يُختم عند الإنشاء ويُرحَّل إلى التكاليف عند إكمال الزيارة.
              </span>
            </div>
          ) : null}

          {type === "court_visit" && assigneeId && !needsVisitFee ? (
            <div className={opsFldFull}>
              <p className="m-0 rounded-md border border-border/70 bg-surface-2/60 px-3 py-2 text-[12px] leading-snug text-text-2">
                المراجع الموظف لا يستحق أتعاب زيارة — لا يظهر بند في التكاليف.
                الحوافز عبر جداول flat (إن وُجدت). للمتعاون اختر منفّذاً بنوع
                عقد متعاون/خارجي لتمكين مبلغ الزيارة.
              </p>
            </div>
          ) : null}

          <div className={opsFldFull}>
            <label className={opsTfLblInFld}>الوصف</label>
            <textarea
              className={opsFldTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="تفاصيل إضافية للمنفّذ (اختياري)"
            />
          </div>

          <div className={opsFldFull}>
            <label className={opsTfLblInFld}>نطاق الربط *</label>
            <SegRow
              value={scope}
              onChange={(id) => {
                setScope(id);
              }}
              options={LINK_SCOPES.map((s) => ({
                id: s,
                label: OPERATIONS_TASK_SCOPE_LABELS[s] ?? s,
              }))}
            />
          </div>

          {scope !== "general" && scope !== "multi" ? (
            <div className={opsFldFull}>
              <label className={opsTfLblInFld}>أمر العمل *</label>
              <select
                className={opsFldControl}
                value={poNumber}
                onChange={(e) => {
                  setPoNumber(e.target.value);
                  setDeed("");
                  setSelectedDeeds([]);
                }}
              >
                <option value="">اختر أمر العمل…</option>
                {poOptions.map((r) => (
                  <option key={r.poNumber} value={r.poNumber.trim()}>
                    {r.poNumber.trim()}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scope === "general" ? (
            <div className={opsFldFull}>
              <div className={opsTfNote}>
                مهمة مستقلة تماماً بلا ربط بمعاملة أو أمر عمل.
              </div>
            </div>
          ) : null}

          {scope === "multi" ? (
            <div className={opsFldFull}>
              <div className={opsTfNote}>
                اختر صكوكاً من أي أوامر عمل — يُجمَّع خطاب التفويض حسب المحكمة/الدائرة.
              </div>
            </div>
          ) : null}

          {scope === "transaction" && selectedPo ? (
            <div className={opsFldFull}>
              <label className={opsTfLblInFld}>المعاملة (الصك) *</label>
              <select
                className={opsFldControl}
                value={deed}
                onChange={(e) => setDeed(e.target.value)}
              >
                <option value="">اختر الصك…</option>
                {deeds.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scope === "multi" ? (
            <div className={opsFldFull}>
              <span className={opsTfLblInFld}>
                المعاملات المرتبطة *{" "}
                <span className="font-medium text-text-3">(صكّان فأكثر)</span>
              </span>
              <div className={opsTfDeeds}>
                {multiDeedOptions.map(({ deed: d, po }) => (
                  <label key={`${po}-${d}`} className={opsTfDeed}>
                    <input
                      type="checkbox"
                      className={opsTfDeedCheck}
                      checked={selectedDeeds.includes(d)}
                      onChange={() => toggleDeed(d)}
                    />
                    <span className="font-bold text-gold-d" dir="ltr">
                      {d}
                    </span>
                    <span className="text-[11px] text-text-3">{po}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className={opsFldFull}>
            <label className={opsTfLblInFld}>الأولوية *</label>
            <SegRow
              value={priority}
              onChange={applyPriorityDue}
              options={Object.entries(OPERATIONS_TASK_PRIORITY_LABELS).map(
                ([id, label]) => ({ id, label }),
              )}
            />
            <span className="mt-1.5 block text-[11px] text-text-3">
              تضبط الأولوية موعد الاستحقاق المقترح — «متوسطة» (الافتراضي) تعادل نصف يوم.
            </span>
          </div>

          <div className={opsFldFull}>
            <label className={opsTfLblInFld}>
              موعد الاستحقاق *{" "}
              <span className={opsFileSize}>
                (يوم + ساعة)
              </span>
            </label>
            <div className="mb-[11px] flex flex-wrap gap-2">
              {(
                [
                  ["today", "اليوم"],
                  ["tomorrow", "غداً"],
                  ["after", "بعد غد"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={dueChip === id ? opsTfChipActive : opsTfChip}
                  onClick={() => applyDueChip(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <input
                type="date"
                className={cn(opsFldControl, "max-w-[190px]")}
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueChip(null);
                }}
              />
              <input
                type="time"
                className={cn(opsFldControl, "max-w-[150px]")}
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          {type === "court_visit" && letterPreview.length > 0 ? (
            <div className={opsFldFull}>
              <div className={cn(opsLetterCard, "mt-1")}>
                <div className={opsLetterHead}>
                  <div>
                    <div className={opsLetterTitle}>خطاب التفويض الداخلي</div>
                    <div className={opsLetterSub}>
                      مفتاح التجميع: المحكمة + الدائرة · لقطة (snapshot) عند الإصدار
                    </div>
                  </div>
                  <span className="text-xs font-bold text-text-2">
                    الرقم المرجعي:{" "}
                    <span className="text-gold-d">يُصدر عند الإنشاء</span>
                  </span>
                </div>
                <div className="px-3.5 py-3">
                  <LetterTable rows={letterPreview} />
                  <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
                    لقطة (snapshot) لبيانات الصكوك والمحاكم وقت إنشاء المهمة — تُثبَّت على
                    الخطاب ولا تتأثر بتعديلات لاحقة على أمر العمل.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
    </AppModal>
  );
}
