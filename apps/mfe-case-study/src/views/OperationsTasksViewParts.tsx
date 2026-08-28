"use client";

/** أجزاء شاشة مهام العمليات — مكوّنات ومساعدات على مستوى الوحدة، نُقلت حرفياً من الشاشة (SRP). */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Input,
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  Note,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShell,
  PanelSkeleton,
  Select,
  StatusPill,
  Textarea,
  cn,
  useToast,
  Spinner,
} from "@platform/ui-kit";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { pad2 } from "@platform/app-shared/format/date";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { displayPersonName } from "@platform/app-shared/prototype/person-display-name";
import { useStaffUsersQuery, useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { usePoRecordsQuery } from "../query/case-study-queries";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/prototype/po-intake-data";
import { useOperationsTasksQuery } from "../query/operations-tasks-queries";
import {
  addOperationsTaskCommentRecord,
  isActiveOperationsTask,
  isTerminalOperationsTask,
  patchOperationsTaskRecord,
  reassignOperationsTaskRecord,
  remindOperationsTaskRecord,
  type OperationsTask,
} from "../lib/prototype/operations-tasks-storage";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  OPERATIONS_TASK_PRIORITY_LABELS,
  OPERATIONS_TASK_REMIND_LABELS,
  OPERATIONS_TASK_SCOPE_LABELS,
  OPERATIONS_TASK_STATUS_COLORS,
  OPERATIONS_TASK_STATUS_LABELS,
  OPERATIONS_TASK_TYPE_ICON_PATHS,
  TASK_STEPPER_STEPS,
  formatTaskDueLabel,
  isTerminalOperationsTaskStatus,
  operationsTaskLinkLabel,
  operationsTaskPriorityLabel,
  operationsTaskReceiptLabel,
  operationsTaskScopeLabel,
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
  printOperationsTaskDelegationLetter,
  remindCountdownLabelForTask,
  taskCountdown,
  taskStepperIndex,
  taskUrgency,
} from "../lib/prototype/operations-task-display";
import { resolveSlaTimerRatio } from "../lib/prototype/my-task-row";
import {
  canManageOperationsTasks,
  canRemindOperationsTasks,
  operationsTasksUseAssigneeScope,
} from "../lib/prototype/operations-task-roles";
import { failureTargetsForOperationsTask } from "../lib/prototype/operations-task-failure-targets";
import type { OperationsTaskFailureTarget } from "../lib/prototype/operations-task-failure-targets";
import {
  isOperationsTaskBlockedByFailure,
  isOpsTaskFailurePauseReason,
  OPS_TASK_FAILURE_PAUSE_REASON,
} from "../lib/prototype/operations-task-failure-obstruction";
import {
  GOVERNMENT_REVIEWER_FAILURE_RAISER,
  useFailuresQuery,
} from "@failures/mfe";
import { FailureRaiseModal } from "../components/failures/FailureRaiseModal";
import { agentInfoFromStaff } from "../lib/prototype/internal-delegation-letters";
import {
  partyAccountForRole,
  partyAccountForViewer,
  type DistributionAssignee,
} from "../lib/prototype/distribution-parties";
import { assigneesForOperationsTaskType } from "../lib/prototype/operations-task-assignees";
import {
  downloadTaskAttachmentAsync,
  uploadTaskScopedAttachment,
} from "@platform/app-shared/prototype/task-attachments-api";
import { AppModal } from "../components/ui/AppModal";
import {
  RowMoreMenu,
  RowMoreMenuIcons,
  type RowMoreMenuItem,
} from "../components/ui/RowMoreMenu";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "../components/queue/ActiveQueueMobileCards";
import type { CreateOperationsTaskPrefill } from "../components/CreateOperationsTaskModal";
import {
  TASKS_LIST_COLS,
  TASKS_LIST_FOOTER,
  TasksEmptyRows,
  TasksKpiActiveIcon,
  TasksKpiCompletedIcon,
  TasksKpiCreatedIcon,
  TasksKpiInProgressIcon,
  TasksSectionNote,
  TasksShowAllEye,
  tasksDescClassName,
} from "../components/tasks/TasksHtmlPrimitives";
import { ReassignOperationsTaskModal } from "../components/tasks/ReassignOperationsTaskModal";
import {
  opsAttachBtn,
  opsBulk,
  opsBulkClear,
  opsBtnGhost,
  opsBtnPrimary,
  opsCdDot,
  opsCdTip,
  opsCdWrap,
  opsCmt,
  opsCmtAv,
  opsCmtBar,
  opsCmtBody,
  opsCmtComposer,
  opsCmtFiles,
  opsCmtH,
  opsCmtName,
  opsCmtRole,
  opsCmtText,
  opsCmtTextarea,
  opsCmtThread,
  opsCmtTime,
  opsCmtEvent,
  opsDueCd,
  opsDueCdOver,
  opsDotSep,
  opsFileSize,
  opsBulkCount,
  opsListCount,
  opsLetterRow,
  opsTypeIconSm,
  opsRowTitle,
  opsRowMeta,
  opsEmptyHint,
  opsEventAv,
  opsFileChip,
  opsFileChipFx,
  opsFilters,
  opsGridRow,
  opsHeadRow,
  opsIconBoxGold,
  opsLetterBodyPad,
  opsLetterCard,
  opsLetterHead,
  opsLetterMeta,
  opsLetterSub,
  opsLetterTitle,
  opsMutedHint,
  opsPpBadge,
  opsPpCell,
  opsPpCellK,
  opsPpCellV,
  opsPpHead,
  opsPpMeta,
  opsPpSummary,
  opsPpTitle,
  opsReceiptConfirmBtn,
  opsReceiptConfirmWrap,
  opsRemindBtn,
  opsRemindCard,
  opsRemindMini,
  opsShowAllBtn,
  opsShowAllBtnOn,
  opsStep,
  opsStepDot,
  opsStepDotActive,
  opsStepDotCancel,
  opsStepDotDone,
  opsStepDotIdle,
  opsStepFlow,
  opsStepLbl,
  opsStepLblOn,
  opsStepLine,
  opsStepLineOn,
  opsTd,
  opsTdC,
  opsTh,
  opsThStart,
  opsThead,
  opsTkCheck,
  opsTkCheckInput,
  opsToolbar,
  opsTfActions,
  opsTfChip,
  opsTfLbl,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/prototype/ops-tasks-tw";

export const LETTER_COLS =
  "2.75rem minmax(5.75rem,0.9fr) minmax(9.5rem,1.35fr) minmax(7rem,1.05fr) minmax(5.5rem,0.85fr) minmax(11rem,1.55fr)";

export const letterTh =
  "flex items-center justify-start px-3 py-3 text-start text-[11.5px] font-bold leading-snug text-heading";
export const letterTd =
  "flex min-w-0 items-center justify-start overflow-hidden px-3 py-3 text-start text-[12.5px] leading-snug";
export const letterCellLtr = "inline-block max-w-full truncate tabular-nums tracking-tight";

export const PRIORITY_OFFSET_MS: Record<string, number> = {
  high: 4 * 3_600_000,
  medium: 12 * 3_600_000,
  low: 24 * 3_600_000,
};

export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type DraftFile = {
  name: string;
  size: string;
  file?: File;
  attachmentId?: string;
  contentType?: string;
};

export function filesFromList(list: FileList | null): DraftFile[] {
  if (!list) return [];
  return Array.from(list).map((f) => ({ name: f.name, size: fmtFileSize(f.size), file: f }));
}

export const OPS_COMMENT_ATTACHMENT_SCOPE = "operations-task-comment";

/** Uploads any draft files that still hold a raw File (not yet persisted) and
 * returns the plain attachment payload to send with the comment. */
export async function uploadDraftFiles(
  taskId: string,
  files: DraftFile[],
): Promise<{ name: string; size: string; attachmentId?: string | null; contentType?: string | null }[]> {
  const results: { name: string; size: string; attachmentId?: string | null; contentType?: string | null }[] = [];
  for (const f of files) {
    if (f.attachmentId || !f.file) {
      results.push({
        name: f.name,
        size: f.size,
        attachmentId: f.attachmentId ?? null,
        contentType: f.contentType ?? null,
      });
      continue;
    }
    const scopeKey = `${taskId}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const uploaded = await uploadTaskScopedAttachment(OPS_COMMENT_ATTACHMENT_SCOPE, scopeKey, f.file);
    results.push({
      name: f.name,
      size: f.size,
      attachmentId: uploaded?.attachmentId ?? null,
      contentType: uploaded?.mimeType ?? f.file.type ?? null,
    });
  }
  return results;
}

export function TypeIcon({ type, size = 15 }: { type: string; size?: number }) {
  const paths =
    OPERATIONS_TASK_TYPE_ICON_PATHS[type] ?? OPERATIONS_TASK_TYPE_ICON_PATHS.general;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: paths! }}
    />
  );
}

export function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function FlagIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function PaperclipIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
    </svg>
  );
}

export function DraftFileChips({
  files,
  onRemove,
}: {
  files: DraftFile[];
  onRemove?: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className={opsCmtFiles}>
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className={opsFileChip}>
          <span>{f.name}</span>
          <span className={opsFileSize}>{f.size}</span>
          {onRemove ? (
            <button
              type="button"
              className={opsFileChipFx}
              aria-label="إزالة المرفق"
              onClick={() => onRemove(i)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export type CourtVisitKind = "received" | "other_party" | "none" | "other" | "";

export type CourtVisitContactDraft = {
  scope: string;
  name: string;
  role: string;
  phone: string;
  note: string;
};

export const COURT_VISIT_KIND_OPTIONS: { id: Exclude<CourtVisitKind, "">; label: string }[] = [
  { id: "received", label: "استُلم ظرف مفاتيح" },
  { id: "other_party", label: "الظرف عند طرف آخر (إفادة الدائرة)" },
  { id: "none", label: "لا توجد مفاتيح مسجلة لدى الدائرة" },
  { id: "other", label: "أخرى" },
];

export function emptyCourtContact(): CourtVisitContactDraft {
  return { scope: "property", name: "", role: "", phone: "", note: "" };
}

export function CloseTaskModalBody({
  taskType,
  letterRows,
  closeOutcome,
  setCloseOutcome,
  canCancel,
  allowCompleteOutcome = true,
  cancelReason,
  setCancelReason,
  closeText,
  setCloseText,
  closeFiles,
  setCloseFiles,
  fileInputRef,
  courtKind,
  setCourtKind,
  courtOtherText,
  setCourtOtherText,
  courtStatement,
  setCourtStatement,
  courtPerDeed,
  setCourtPerDeed,
  courtContacts,
  setCourtContacts,
  showCreditPicker,
  creditAssignees,
  creditAssigneeId,
  setCreditAssigneeId,
  setCreditAssigneeName,
  formError,
  busy,
  onCancel,
  onConfirm,
}: {
  taskType?: string;
  letterRows?: OperationsTask["letterRows"];
  closeOutcome: "completed" | "cancelled";
  setCloseOutcome: (v: "completed" | "cancelled") => void;
  canCancel: boolean;
  /** When false (e.g. status still created), only cancellation is offered. */
  allowCompleteOutcome?: boolean;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  closeText: string;
  setCloseText: (v: string) => void;
  closeFiles: DraftFile[];
  setCloseFiles: (v: DraftFile[] | ((prev: DraftFile[]) => DraftFile[])) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  courtKind: CourtVisitKind;
  setCourtKind: (v: CourtVisitKind) => void;
  courtOtherText: string;
  setCourtOtherText: (v: string) => void;
  courtStatement: string;
  setCourtStatement: (v: string) => void;
  courtPerDeed: Record<string, string>;
  setCourtPerDeed: (
    v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  courtContacts: CourtVisitContactDraft[];
  setCourtContacts: (
    v:
      | CourtVisitContactDraft[]
      | ((prev: CourtVisitContactDraft[]) => CourtVisitContactDraft[]),
  ) => void;
  showCreditPicker?: boolean;
  creditAssignees?: { id: string; name: string }[];
  creditAssigneeId?: string;
  setCreditAssigneeId?: (v: string) => void;
  setCreditAssigneeName?: (v: string) => void;
  formError: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isCourtVisit = taskType === "court_visit";
  const rows = letterRows ?? [];
  const isCancel = closeOutcome === "cancelled";

  return (
    <div className="flex flex-col gap-3">
      <p className={opsMutedHint}>
        {allowCompleteOutcome ? (
          <>
            اختر نتيجة الإغلاق: <b>منجزة</b> أو <b>ملغاة</b>
          </>
        ) : (
          <>
            المهمة لم تُستلم بعد — يمكن <b>إلغاؤها</b> فقط. لإتمامها أكّد الاستلام
            أولاً.
          </>
        )}
      </p>

      {canCancel ? (
        <div>
          <span className={opsTfLbl}>نتيجة الإغلاق *</span>
          <div className="mt-2 grid gap-[7px]">
            {allowCompleteOutcome ? (
              <label className="flex cursor-pointer items-center gap-[9px] text-[12.5px] text-text">
                <input
                  type="radio"
                  name="closeOutcome"
                  value="completed"
                  checked={closeOutcome === "completed"}
                  className="h-[15px] w-[15px] shrink-0 accent-gold-d"
                  onChange={() => setCloseOutcome("completed")}
                />
                <span>منجزة</span>
              </label>
            ) : null}
            <label className="flex cursor-pointer items-center gap-[9px] text-[12.5px] text-text">
              <input
                type="radio"
                name="closeOutcome"
                value="cancelled"
                checked={closeOutcome === "cancelled"}
                className="h-[15px] w-[15px] shrink-0 accent-gold-d"
                onChange={() => setCloseOutcome("cancelled")}
              />
              <span>ملغاة</span>
            </label>
          </div>
        </div>
      ) : null}

      <Note tone={isCancel ? "danger" : "success"} className="text-[12.5px]">
        {isCancel ? (
          <>
            سيتم تحويل حالة المهمة إلى <b className="text-[#c0553d]">ملغاة</b> مع
            تسجيل سبب الإلغاء.
          </>
        ) : (
          <>
            سيتم تحويل حالة المهمة إلى <b className="text-[#2f7a4d]">منجزة</b> وإشعار
            المنشئ.
          </>
        )}
      </Note>
      {formError ? (
        <Note tone="danger" className="text-[12.5px]">
          {formError}
        </Note>
      ) : null}

      {isCancel ? (
        <label className="flex flex-col gap-1.5">
          <span className={opsTfLbl}>سبب الإلغاء *</span>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="اذكر سبب الإلغاء (إلزامي)…"
            rows={3}
          />
        </label>
      ) : (
        <>
          {showCreditPicker && setCreditAssigneeId && setCreditAssigneeName ? (
            <label className="flex flex-col gap-1.5">
              <span className={opsTfLbl}>مسؤولية التنفيذ *</span>
              <p className={opsMutedHint}>
                أُعيد توجيه هذه المهمة — الافتراضي للمنفّذ الأول، ويمكنك التعديل.
              </p>
              <Select
                value={creditAssigneeId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  setCreditAssigneeId(id);
                  setCreditAssigneeName(
                    creditAssignees?.find((a) => a.id === id)?.name ?? "",
                  );
                }}
              >
                {(creditAssignees ?? []).length === 0 ? (
                  <option value="">لا يوجد منفّذون</option>
                ) : (
                  (creditAssignees ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </Select>
            </label>
          ) : null}

          {isCourtVisit ? (
            <div className="flex flex-col gap-3">
              <div>
                <span className={opsTfLbl}>
                  موقف المفاتيح لدى المحكمة *{" "}
                  <span className="font-semibold text-text-3">(اختيار واحد)</span>
                </span>
                <div className="mt-2 grid gap-[7px]">
                  {COURT_VISIT_KIND_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-[9px] text-[12.5px] text-text"
                    >
                      <input
                        type="radio"
                        name="cvKind"
                        value={opt.id}
                        checked={courtKind === opt.id}
                        className="h-[15px] w-[15px] shrink-0 accent-gold-d"
                        onChange={() => {
                          setCourtKind(opt.id);
                          if (opt.id === "other_party" && courtContacts.length === 0) {
                            setCourtContacts([emptyCourtContact()]);
                          }
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {courtKind === "other" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={opsTfLbl}>اذكر النتيجة *</span>
                  <Input
                    value={courtOtherText}
                    onChange={(e) => setCourtOtherText(e.target.value)}
                    placeholder="اذكر النتيجة…"
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className={opsTfLbl}>إفادة المحكمة على مستوى الطلب</span>
                <Textarea
                  value={courtStatement}
                  onChange={(e) => setCourtStatement(e.target.value)}
                  placeholder="نص الإفادة العامة للطلب…"
                  rows={2}
                />
              </label>

              {rows.length > 0 ? (
                <div>
                  <span className={opsTfLbl}>
                    إفادات الصكوك{" "}
                    <span className="font-semibold text-text-3">(إن وجدت)</span>
                  </span>
                  <div className="mt-2 grid gap-2">
                    {rows.map((rw) => (
                      <div key={rw.deed} className="flex items-center gap-[9px]">
                        <span
                          dir="ltr"
                          className="min-w-[96px] shrink-0 text-[11.5px] font-bold text-gold-d"
                        >
                          صك {rw.deed}
                        </span>
                        <Input
                          value={courtPerDeed[rw.deed] ?? ""}
                          onChange={(e) =>
                            setCourtPerDeed((prev) => ({
                              ...prev,
                              [rw.deed]: e.target.value,
                            }))
                          }
                          placeholder="إفادة هذا الصك…"
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {courtKind === "other_party" ? (
                <div>
                  <span className={opsTfLbl}>
                    بيانات التواصل مع الأطراف *{" "}
                    <span className="font-semibold text-text-3">
                      (على مستوى العقار أو الصك)
                    </span>
                  </span>
                  <div className="mt-2 grid gap-2">
                    {courtContacts.map((c, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[.9fr_1.2fr_1fr_1fr_1.1fr_auto] items-center gap-[7px]"
                      >
                        <Select
                          value={c.scope}
                          onChange={(e) =>
                            setCourtContacts((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, scope: e.target.value } : row,
                              ),
                            )
                          }
                        >
                          <option value="property">العقار</option>
                          {rows.map((rw) => (
                            <option key={rw.deed} value={rw.deed}>
                              صك {rw.deed}
                            </option>
                          ))}
                        </Select>
                        <Input
                          value={c.name}
                          placeholder="الاسم *"
                          onChange={(e) =>
                            setCourtContacts((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, name: e.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Input
                          value={c.role}
                          placeholder="الصفة"
                          onChange={(e) =>
                            setCourtContacts((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, role: e.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Input
                          dir="ltr"
                          value={c.phone}
                          placeholder="05xxxxxxxx"
                          onChange={(e) =>
                            setCourtContacts((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, phone: e.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Input
                          value={c.note}
                          placeholder="ملاحظات"
                          onChange={(e) =>
                            setCourtContacts((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, note: e.target.value } : row,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="h-[30px] w-[30px] border-none bg-transparent text-[15px] text-text-3"
                          aria-label="حذف"
                          onClick={() =>
                            setCourtContacts((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={cn(opsAttachBtn, "mt-2 self-start")}
                    onClick={() =>
                      setCourtContacts((prev) => [...prev, emptyCourtContact()])
                    }
                  >
                    <span>+ إضافة جهة اتصال</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className={opsTfLbl}>تعليق الإغلاق</span>
            <Textarea
              value={closeText}
              onChange={(e) => setCloseText(e.target.value)}
              placeholder="لخّص ما تم إنجازه…"
              rows={3}
            />
          </label>
          <DraftFileChips
            files={closeFiles}
            onRemove={(index) =>
              setCloseFiles((prev) => prev.filter((_, i) => i !== index))
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const next = filesFromList(e.target.files);
              if (next.length) setCloseFiles((prev) => [...prev, ...next]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={cn(opsAttachBtn, "self-start")}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon />
            <span>إرفاق مستند</span>
          </button>
        </>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className={opsBtnGhost} onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={onConfirm}
        >
          {busy ? <Spinner /> : null}
          <span>
            {busy
              ? "جاري التنفيذ…"
              : isCancel
                ? "تأكيد الإلغاء"
                : "إغلاق المهمة"}
          </span>
        </button>
      </div>
    </div>
  );
}

export function PauseModalBody({
  pauseReason,
  setPauseReason,
  pauseError,
  busy,
  onCancel,
  onConfirm,
}: {
  pauseReason: string;
  setPauseReason: (v: string) => void;
  pauseError: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {pauseError ? <Note tone="danger">{pauseError}</Note> : null}
      <label className="flex flex-col gap-1.5">
        <span className={opsTfLbl}>سبب الإيقاف *</span>
        <Textarea
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
          placeholder="مثال: بانتظار رد الدائرة…"
          rows={2}
        />
      </label>
      <p className={opsMutedHint}>
        بعد تجاوز يوم عمل تُرسَل تذكيرات يومية للمنشئ والمنفّذ حتى الاستئناف أو
        الإغلاق.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className={opsBtnGhost} onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={onConfirm}
        >
          {busy ? <Spinner /> : null}
          <span>{busy ? "جاري الإيقاف…" : "إيقاف المهمة"}</span>
        </button>
      </div>
    </div>
  );
}

export function PriorityModalBody({
  task,
  prioValue,
  setPrioValue,
  prioEditDue,
  setPrioEditDue,
  prioDueDate,
  setPrioDueDate,
  prioDueTime,
  setPrioDueTime,
  onFitPriorityDue,
  busy,
  onCancel,
  onApply,
}: {
  task: OperationsTask;
  prioValue: string;
  setPrioValue: (v: string) => void;
  prioEditDue: boolean;
  setPrioEditDue: (v: boolean) => void;
  prioDueDate: string;
  setPrioDueDate: (v: string) => void;
  prioDueTime: string;
  setPrioDueTime: (v: string) => void;
  onFitPriorityDue: () => void;
  busy: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  const prColor = OPERATIONS_TASK_PRIORITY_COLORS[task.priority] ?? "#8a8d96";
  return (
    <div className="flex flex-col gap-3">
      <p className={opsMutedHint}>
        طرأ ما يستعجل الإنجاز؟ صعّد الأولوية — يُحدَّث تواتر التذكير تلقائياً
      </p>
      <div className="text-[12.5px] text-text-2">
        الأولوية الحالية:{" "}
        <b style={{ color: prColor }}>{operationsTaskPriorityLabel(task.priority)}</b>
      </div>
      <div>
        <span className={opsTfLbl}>الأولوية الجديدة</span>
        <div className={opsTfSegRow}>
          {Object.entries(OPERATIONS_TASK_PRIORITY_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={prioValue === id ? opsTfSegActive : opsTfSeg}
              onClick={() => setPrioValue(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-[9px] text-[11.5px] text-text-3">
          تذكير تلقائي{" "}
          {OPERATIONS_TASK_REMIND_LABELS[prioValue] ?? OPERATIONS_TASK_REMIND_LABELS.medium}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-[9px] text-[12.5px] text-text-2">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-gold-d"
          checked={prioEditDue}
          onChange={(e) => setPrioEditDue(e.target.checked)}
        />
        <span>تعديل موعد الاستحقاق</span>
      </label>
      {prioEditDue ? (
        <div>
          <div className="mb-2.5 flex flex-wrap gap-2">
            <button type="button" className={opsTfChip} onClick={onFitPriorityDue}>
              ضبط حسب الأولوية الجديدة
            </button>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Input
              type="date"
              value={prioDueDate}
              onChange={(e) => setPrioDueDate(e.target.value)}
              className="max-w-[180px]"
            />
            <Input
              type="time"
              value={prioDueTime}
              onChange={(e) => setPrioDueTime(e.target.value)}
              className="max-w-[140px]"
            />
          </div>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={opsBtnGhost} onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={onApply}
        >
          {busy ? <Spinner /> : null}
          <span>{busy ? "جاري التطبيق…" : "تطبيق"}</span>
        </button>
      </div>
    </div>
  );
}

export function PlusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toLocalTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function assigneesForType(
  type: string,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  return assigneesForOperationsTaskType(type, staffUsers);
}

export function assigneeRoleLabel(staffUsers: StaffUser[], assigneeId: string): string {
  const id = assigneeId.trim();
  if (!id) return "منفّذ";
  const u = staffUsers.find((s) => s.distributionAssigneeId?.trim() === id);
  return u?.role?.trim() || "منفّذ";
}

export function statusPillStyle(status: string) {
  const color = OPERATIONS_TASK_STATUS_COLORS[status] ?? "#8a8d96";
  return { base: color, fg: color };
}

export function TaskStatusPill({ status }: { status: string }) {
  return (
    <StatusPill
      label={operationsTaskStatusLabel(status)}
      style={statusPillStyle(status)}
    />
  );
}

export function DueCell({ task, now }: { task: OperationsTask; now: number }) {
  const cd = taskCountdown(task.dueAt, task.status, now);
  const urgency = taskUrgency(task.dueAt, task.status, now);
  if (!isActiveOperationsTask(task)) {
    return (
      <span className="text-[12.5px] text-text-3">
        {task.status === "paused" ? "متوقفة" : "—"}
      </span>
    );
  }
  return (
    <div className={opsCdWrap}>
      <span
        className={cn(
          opsCdDot,
          urgency?.pulse &&
            "animate-[ops-pulse-fade_1.4s_ease-in-out_infinite] after:absolute after:inset-0 after:animate-[ops-pulse-ring_1.6s_ease-out_infinite] after:rounded-full after:bg-inherit motion-reduce:animate-none motion-reduce:after:animate-none",
        )}
        style={{ background: urgency?.color ?? "#3f8f5f" }}
        aria-hidden
      />
      {/* Keep Arabic overdue labels in one LTR-neutral run so the marker stays
          flush with the start edge of the column (matches header). */}
      <span className={cd.over ? opsDueCdOver : opsDueCd}>{cd.txt}</span>
      <span className={opsCdTip}>
        <span
          className="absolute top-full start-3.5 border-[5px] border-solid border-transparent border-t-ink"
          aria-hidden
        />
        الاستحقاق: {formatTaskDueLabel(task.dueAt)}
      </span>
    </div>
  );
}

export function TaskStepper({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className={opsStepFlow}>
        <div className={opsStep}>
          <span className={cn(opsStepDot, opsStepDotDone)}>✓</span>
          <span className={opsStepLblOn}>منشأة</span>
        </div>
        <div className={opsStepLine} />
        <div className={opsStep}>
          <span className={cn(opsStepDot, opsStepDotCancel)}>✕</span>
          <span className={opsStepLblOn}>ملغاة</span>
        </div>
      </div>
    );
  }
  const idx = taskStepperIndex(status);
  const allDone = status === "completed";
  return (
    <div className={opsStepFlow}>
      {TASK_STEPPER_STEPS.map((step, i) => {
        const done = allDone || (idx != null && i < idx);
        const current = !allDone && idx != null && i === idx;
        return (
          <div key={step.id} className="contents">
            <div className={opsStep}>
              <span
                className={cn(
                  opsStepDot,
                  done
                    ? opsStepDotDone
                    : current
                      ? opsStepDotActive
                      : opsStepDotIdle,
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done || current ? opsStepLblOn : opsStepLbl}>
                {step.label}
              </span>
            </div>
            {i < TASK_STEPPER_STEPS.length - 1 ? (
              <div className={done ? opsStepLineOn : opsStepLine} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function CommentThread({
  task,
  staffUsers,
  commentText,
  setCommentText,
  draftFiles,
  setDraftFiles,
  fileInputRef,
  busy,
  onSend,
}: {
  task: OperationsTask;
  staffUsers: StaffUser[];
  commentText: string;
  setCommentText: (v: string) => void;
  draftFiles: DraftFile[];
  setDraftFiles: (v: DraftFile[] | ((prev: DraftFile[]) => DraftFile[])) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onSend: () => void;
}) {
  const assigneeRole = assigneeRoleLabel(staffUsers, task.assigneeId);
  const comments = task.comments;
  const canSend = Boolean(commentText.trim() || draftFiles.length);
  return (
    <div className={cn(opsLetterCard, "mt-5")}>
      <div className={opsLetterHead}>
        <div className={opsHeadRow}>
          <span className={opsIconBoxGold}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <div>
            <div className={opsLetterTitle}>التحديثات والاستفسارات</div>
            <div className={opsLetterSub}>
              سجل التواصل بين المنشئ والمنفّذ — مع إرفاق المستندات من الطرفين
            </div>
          </div>
        </div>
        <span className={opsLetterMeta}>{comments.length} تحديث</span>
      </div>
      <div className={opsLetterBodyPad}>
        <div className={opsCmtThread}>
          {comments.length === 0 ? (
            <div className={opsEmptyHint}>
              لا توجد تحديثات بعد — أضف أول تحديث أو استفسار على المهمة.
            </div>
          ) : (
            comments.map((c, i) => {
              if (c.kind === "reminder" || c.kind === "update") {
                return (
                  <div key={`${c.at}-${i}`} className={opsCmtEvent}>
                    <span className={opsEventAv}>
                      {c.kind === "update" ? <FlagIcon size={15} /> : <BellIcon size={15} />}
                    </span>
                    <div className={cn(opsCmtBody, "flex flex-wrap items-center gap-[9px]")}>
                      <span className="text-[12.5px] font-semibold text-text-2">
                        {c.text}
                      </span>
                      <span className={opsCmtTime}>{formatTaskDueLabel(c.at)}</span>
                    </div>
                  </div>
                );
              }
              const isC = c.who === "creator";
              const name = isC
                ? displayPersonName(task.createdByName, {
                    userId: task.createdBy,
                    staffUsers,
                    fallback: "المنشئ",
                  })
                : displayPersonName(task.assigneeName, {
                    userId: task.assigneeId,
                    staffUsers,
                    fallback: "المنفّذ",
                  });
              const role = isC ? "منشئ المهمة" : assigneeRole;
              const col = isC ? "var(--ink)" : "var(--gold-d)";
              return (
                <div key={`${c.at}-${i}`} className={opsCmt}>
                  <span className={opsCmtAv} style={{ background: col }}>
                    {name.charAt(0)}
                  </span>
                  <div className={opsCmtBody}>
                    <div className={opsCmtH}>
                      <span className={opsCmtName}>{name}</span>
                      <span
                        className={opsCmtRole}
                        style={{
                          background: `color-mix(in srgb, ${col} 13%, transparent)`,
                          color: col,
                        }}
                      >
                        {role}
                      </span>
                      {c.kind === "close" ? (
                        <span
                          className={opsCmtRole}
                          style={{
                            background: "color-mix(in srgb, #3f8f5f 15%, transparent)",
                            color: "#2f7a4d",
                          }}
                        >
                          تعليق إغلاق
                        </span>
                      ) : null}
                      <span className={opsCmtTime}>{formatTaskDueLabel(c.at)}</span>
                    </div>
                    {c.text ? <div className={opsCmtText}>{c.text}</div> : null}
                    {c.files && c.files.length > 0 ? (
                      <div className={opsCmtFiles}>
                        {c.files.map((f, fi) =>
                          f.attachmentId ? (
                            <button
                              key={`${f.name}-${fi}`}
                              type="button"
                              className={cn(opsFileChip, "cursor-pointer")}
                              title="تنزيل المرفق"
                              onClick={() =>
                                void downloadTaskAttachmentAsync({
                                  fileName: f.name,
                                  mimeType: f.contentType || "application/octet-stream",
                                  attachmentId: f.attachmentId!,
                                })
                              }
                            >
                              <PaperclipIcon />
                              <span className="underline">{f.name}</span>
                              <span className={opsFileSize}>{f.size}</span>
                            </button>
                          ) : (
                            <span key={`${f.name}-${fi}`} className={opsFileChip}>
                              <span>{f.name}</span>
                              <span className={opsFileSize}>{f.size}</span>
                            </span>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {task.status !== "cancelled" ? (
          <div className={opsCmtComposer}>
            <textarea
              className={opsCmtTextarea}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="أضف تحديثاً أو استفساراً على المهمة…"
              rows={3}
            />
            <DraftFileChips
              files={draftFiles}
              onRemove={(index) =>
                setDraftFiles((prev) => prev.filter((_, i) => i !== index))
              }
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const next = filesFromList(e.target.files);
                if (next.length) setDraftFiles((prev) => [...prev, ...next]);
                e.target.value = "";
              }}
            />
            <div className={opsCmtBar}>
              <button
                type="button"
                className={opsAttachBtn}
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <PaperclipIcon />
                <span>إرفاق مستند</span>
              </button>
              <button
                type="button"
                className={cn(opsBtnPrimary, "ms-auto")}
                disabled={busy || !canSend}
                aria-busy={busy || undefined}
                onClick={onSend}
              >
                {busy ? (
                  <Spinner />
                ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
                )}
                <span>{busy ? "جاري الإرسال…" : "إرسال"}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LetterTable({ rows }: { rows: OperationsTask["letterRows"] }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-[12.5px] text-text-3">
        اختر الصكوك المرتبطة لعرض معاينة الخطاب.
      </div>
    );
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[12px] border border-border bg-surface shadow-card lg:block">
        <div className="min-w-[760px]" dir="rtl">
          <div className={opsThead} style={{ gridTemplateColumns: LETTER_COLS }}>
            {[
              "م",
              "أمر العمل",
              PROPERTY_IDENTIFIER_COLUMN_LABEL,
              "المالك",
              "رقم الطلب",
              "المحكمة / الدائرة",
            ].map((h, i) => (
              <div
                key={h}
                className={cn(letterTh, i === 0 && "justify-center text-center")}
              >
                {h}
              </div>
            ))}
          </div>
          {rows.map((row, i) => (
            <div
              key={`${row.po}-${row.deed}-${i}`}
              className={opsLetterRow}
              style={{ gridTemplateColumns: LETTER_COLS }}
            >
              <div className={cn(letterTd, "justify-center text-center text-text-2")}>
                {i + 1}
              </div>
              <div className={cn(letterTd, "font-semibold text-text-2")}>
                <span dir="ltr" className={letterCellLtr}>
                  {row.po}
                </span>
              </div>
              <div className={cn(letterTd, "font-bold text-gold-d")}>
                <span dir="ltr" className={letterCellLtr}>
                  صك {row.deed}
                </span>
              </div>
              <div className={cn(letterTd, "font-medium text-heading")}>
                <span className="line-clamp-2 break-words">{row.owner}</span>
              </div>
              <div className={cn(letterTd, "font-semibold text-text-2")}>
                <span dir="ltr" className={letterCellLtr}>
                  {row.request || "—"}
                </span>
              </div>
              <div className={letterTd}>
                <span className="line-clamp-2 break-words">
                  <span className="font-semibold text-text">{row.court}</span>
                  {row.circuit ? (
                    <span className="text-text-3"> · {row.circuit}</span>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
        {rows.map((row, i) => (
          <li
            key={`${row.po}-${row.deed}-m-${i}`}
            className="rounded-[12px] border border-border border-s-4 border-s-info bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(18,40,76,0.04)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-text-3">#{i + 1}</span>
              <span className="text-[12.5px] font-bold text-gold-d" dir="ltr">
                صك {row.deed}
              </span>
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-text-3">أمر العمل</span>
                <span className="font-semibold text-text-2" dir="ltr">
                  {row.po}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-3">المالك</span>
                <span className="text-end font-semibold text-heading">
                  {row.owner}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-3">رقم الطلب</span>
                <span className="font-semibold text-text-2" dir="ltr">
                  {row.request || "—"}
                </span>
              </div>
              <div className="pt-1 text-[12px] text-text-2">
                <span className="font-semibold text-text">{row.court}</span>
                <span className="text-text-3"> · {row.circuit}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
