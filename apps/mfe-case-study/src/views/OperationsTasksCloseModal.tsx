"use client";

/** Operations-tasks close modal body — outcome, court-visit result and closing comment. */

import { type RefObject } from "react";
import { Input, Note, Select, Textarea, cn, Spinner } from "@platform/ui-kit";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";
import {
  opsAttachBtn,
  opsBtnGhost,
  opsBtnPrimary,
  opsMutedHint,
  opsTfLbl,
} from "../lib/app-data/ops-tasks-tw";
import {
  DraftFileChips,
  DraftFileInput,
  PaperclipIcon,
  type DraftFile,
} from "./OperationsTasksViewShared";

export type CourtVisitKind = "received" | "other_party" | "none" | "other" | "";

export type CourtVisitContactDraft = {
  scope: string;
  name: string;
  role: string;
  phone: string;
  note: string;
};

const COURT_VISIT_KIND_OPTIONS: { id: Exclude<CourtVisitKind, "">; label: string }[] = [
  { id: "received", label: "استُلم ظرف مفاتيح" },
  { id: "other_party", label: "الظرف عند طرف آخر (إفادة الدائرة)" },
  { id: "none", label: "لا توجد مفاتيح مسجلة لدى الدائرة" },
  { id: "other", label: "أخرى" },
];

function emptyCourtContact(): CourtVisitContactDraft {
  return { scope: "property", name: "", role: "", phone: "", note: "" };
}

export type CloseTaskModalBodyProps = {
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
};

function CourtVisitResultFields({
  rows,
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
}: Pick<
  CloseTaskModalBodyProps,
  | "courtKind"
  | "setCourtKind"
  | "courtOtherText"
  | "setCourtOtherText"
  | "courtStatement"
  | "setCourtStatement"
  | "courtPerDeed"
  | "setCourtPerDeed"
  | "courtContacts"
  | "setCourtContacts"
> & { rows: OperationsTask["letterRows"] }) {
  return (
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
  );
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
}: CloseTaskModalBodyProps) {
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
            <CourtVisitResultFields
              rows={rows}
              courtKind={courtKind}
              setCourtKind={setCourtKind}
              courtOtherText={courtOtherText}
              setCourtOtherText={setCourtOtherText}
              courtStatement={courtStatement}
              setCourtStatement={setCourtStatement}
              courtPerDeed={courtPerDeed}
              setCourtPerDeed={setCourtPerDeed}
              courtContacts={courtContacts}
              setCourtContacts={setCourtContacts}
            />
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
          <DraftFileInput fileInputRef={fileInputRef} setFiles={setCloseFiles} />
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
