"use client";

import { useEffect, useMemo, useState } from "react";
import { Note, cn } from "@platform/design-system";
import type {
  CreateOperationsTaskRequest,
  OperationsTaskLetterRowDto,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { AppModal } from "./ui/AppModal";
import {
  getFieldInspectors,
  getGovernmentAuditors,
  getValuators,
  type DistributionAssignee,
} from "../lib/prototype/distribution-parties";
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
  opsLetterRow,
  opsTdCourt,
  opsTdDeed,
  opsTdPlain,
  opsTdPo,
  opsThStart,
  opsFileSize,
  opsTd,
  opsTdC,
  opsTh,
  opsThead,
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

const LETTER_COLS =
  "44px minmax(84px,.9fr) minmax(120px,1.2fr) minmax(100px,1fr) minmax(78px,.8fr) minmax(160px,1.5fr)";

const TASK_TYPES = [
  "court_visit",
  "reshoot",
  "field_visit",
  "inquiry",
  "general",
] as const;

const SCOPES = ["work_order", "transaction", "multi", "general"] as const;

const PRIORITY_OFFSET_MS: Record<string, number> = {
  high: 4 * 3_600_000,
  medium: 12 * 3_600_000,
  low: 24 * 3_600_000,
};

const DEFAULT_TITLES: Record<string, string> = {
  court_visit: "زيارة محكمة",
  reshoot: "إعادة تصوير",
  field_visit: "زيارة ميدانية",
  inquiry: "استفسار",
  general: "مهمة عامة",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

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
  let list: DistributionAssignee[] = [];
  if (type === "court_visit") list = getGovernmentAuditors(staffUsers);
  else if (type === "reshoot" || type === "field_visit") {
    list = getFieldInspectors(staffUsers);
  } else {
    const seen = new Set<string>();
    for (const a of [
      ...getGovernmentAuditors(staffUsers),
      ...getFieldInspectors(staffUsers),
      ...getValuators(staffUsers),
    ]) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      list.push(a);
    }
  }
  if (list.length > 0) return list;
  // Fallback when party role filters yield no staff (demo / incomplete profiles)
  return staffUsers
    .filter((u) => Boolean(u.distributionAssigneeId?.trim()))
    .map((u) => ({
      id: u.distributionAssigneeId!.trim(),
      name: u.name,
      subtitle: u.role,
    }));
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
  prefill?: CreateOperationsTaskPrefill | null;
  onClose: () => void;
  onCreated: (taskId: string) => void;
};

export function CreateOperationsTaskModal({
  open,
  poRecords,
  staffUsers,
  prefill,
  onClose,
  onCreated,
}: Props) {
  const [type, setType] = useState("court_visit");
  const [scope, setScope] = useState("work_order");
  const [title, setTitle] = useState(DEFAULT_TITLES.court_visit);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [poNumber, setPoNumber] = useState("");
  const [deed, setDeed] = useState("");
  const [selectedDeeds, setSelectedDeeds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("12:00");
  const [dueChip, setDueChip] = useState<"today" | "tomorrow" | "after" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignees = useMemo(
    () => assigneesForType(type, staffUsers),
    [type, staffUsers],
  );

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
    if (!selectedPo) return [];
    return buildLetterRowsForPo(selectedPo);
  }, [type, scope, selectedPo, selectedDeeds, poOptions]);

  useEffect(() => {
    if (!open) return;
    const nextType = prefill?.type?.trim() || "court_visit";
    const nextScope =
      prefill?.scope?.trim() ||
      (nextType === "court_visit" ? "work_order" : "general");
    const nextPo = prefill?.poNumber?.trim() || "";
    const nextDeed = prefill?.deed?.trim() || "";
    setType(nextType);
    setScope(nextScope);
    setTitle(prefill?.title?.trim() || DEFAULT_TITLES[nextType] || "مهمة");
    setDescription("");
    setPriority("medium");
    const due = new Date(Date.now() + PRIORITY_OFFSET_MS.medium);
    setDueDate(toLocalDateValue(due));
    setDueTime(toLocalTimeValue(due));
    setDueChip(null);
    setPoNumber(nextPo);
    setDeed(nextDeed);
    setSelectedDeeds(nextDeed ? [nextDeed] : []);
    setError(null);
    setBusy(false);
  }, [open, prefill]);

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
  }, [assignees, assigneeId]);

  const toggleDeed = (value: string) => {
    setSelectedDeeds((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("العنوان مطلوب");
      return;
    }
    if (!assigneeId.trim()) {
      setError("المنفّذ مطلوب");
      return;
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
      open={open}
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
            onClick={() => void handleSubmit()}
          >
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
            <span>إنشاء المهمة</span>
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
          </div>

          <div className={opsFld}>
            <label className={opsTfLblInFld}>مُسندة إلى *</label>
            <select
              className={opsFldControl}
              value={assigneeId}
              onChange={(e) => {
                const id = e.target.value;
                setAssigneeId(id);
                setAssigneeName(assignees.find((a) => a.id === id)?.name ?? "");
              }}
            >
              <option value="">اختر المنفّذ…</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.subtitle ? ` — ${a.subtitle}` : ""}
                </option>
              ))}
            </select>
            {assignees.length === 0 ? (
              <span className="text-[11px] text-text-3">
                لا يوجد منفّذون مطابقون لهذا النوع في بيانات الموظفين.
              </span>
            ) : null}
          </div>

          <div className={opsFldFull}>
            <label className={opsTfLblInFld}>عنوان المهمة *</label>
            <input
              className={opsFldControl}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: زيارة محكمة التنفيذ بجدة"
            />
          </div>

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
              options={SCOPES.map((s) => ({
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
                  <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
                    <div className="min-w-[640px]">
                      <div
                        className={opsThead}
                        style={{ gridTemplateColumns: LETTER_COLS }}
                      >
                        {[
                          "م",
                          "أمر العمل",
                          "رقم الصك",
                          "المالك",
                          "رقم الطلب",
                          "المحكمة / الدائرة",
                        ].map((h, i) => (
                          <div
                            key={h}
                            className={i === 0 ? cn(opsTh, opsTdC) : opsThStart}
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                      {letterPreview.map((row, i) => (
                        <div
                          key={`${row.po}-${row.deed}-${i}`}
                          className={opsLetterRow}
                          style={{ gridTemplateColumns: LETTER_COLS }}
                        >
                          <div className={cn(opsTd, opsTdC, "text-text-2")}>{i + 1}</div>
                          <div className={opsTdPo} dir="ltr">
                            {row.po}
                          </div>
                          <div className={opsTdDeed} dir="ltr">
                            صك {row.deed}
                          </div>
                          <div className={opsTdPlain}>{row.owner}</div>
                          <div className={opsTdPlain} dir="ltr">
                            {row.request}
                          </div>
                          <div className={opsTdCourt}>
                            <span className="font-semibold text-text">{row.court}</span>{" "}
                            <span className="text-text-3">· {row.circuit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
