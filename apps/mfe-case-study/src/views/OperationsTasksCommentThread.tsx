"use client";

/** Operations-tasks detail — the updates / enquiries thread with its composer. */

import { type RefObject } from "react";
import { cn, Spinner, EmptyState } from "@platform/ui-kit";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { displayPersonName } from "@platform/app-shared/app-data/person-display-name";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";
import { formatTaskDueLabel } from "../lib/app-data/operations-task-display";
import { downloadTaskAttachmentAsync } from "@platform/app-shared/app-data/task-attachments-api";
import {
  opsAttachBtn,
  opsBtnPrimary,
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
  opsFileSize,
  opsEventAv,
  opsFileChip,
  opsHeadRow,
  opsIconBoxGold,
  opsLetterBodyPad,
  opsLetterCard,
  opsLetterHead,
  opsLetterMeta,
  opsLetterSub,
  opsLetterTitle,
} from "../lib/app-data/ops-tasks-tw";
import {
  BellIcon,
  DraftFileChips,
  DraftFileInput,
  FlagIcon,
  PaperclipIcon,
  assigneeRoleLabel,
  type DraftFile,
} from "./OperationsTasksViewShared";

const chatBubbleIcon = (
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
);

const sendIcon = (
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
);

type CommentFile = OperationsTask["comments"][number]["files"];

function CommentFileChips({ files }: { files: NonNullable<CommentFile> }) {
  return (
    <div className={opsCmtFiles}>
      {files.map((f, fi) =>
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
  const creatorName = displayPersonName(task.createdByName, {
    userId: task.createdBy,
    staffUsers,
    fallback: "المنشئ",
  });
  const executorName = displayPersonName(task.assigneeName, {
    userId: task.assigneeId,
    staffUsers,
    fallback: "المنفّذ",
  });
  const comments = task.comments;
  const canSend = Boolean(commentText.trim() || draftFiles.length);
  return (
    <div className={cn(opsLetterCard, "mt-5")}>
      <div className={opsLetterHead}>
        <div className={opsHeadRow}>
          <span className={opsIconBoxGold}>{chatBubbleIcon}</span>
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
            <EmptyState line="لا توجد تحديثات بعد — أضف أول تحديث أو استفسار على المهمة." />
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
              const name = isC ? creatorName : executorName;
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
                      <CommentFileChips files={c.files} />
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
            <DraftFileInput fileInputRef={fileInputRef} setFiles={setDraftFiles} />
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
                {busy ? <Spinner /> : sendIcon}
                <span>{busy ? "جاري الإرسال…" : "إرسال"}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
