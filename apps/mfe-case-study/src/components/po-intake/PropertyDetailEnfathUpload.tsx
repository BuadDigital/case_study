"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cn } from "@platform/design-system";
import { EmptyState, ltrValueClass, SectionHeader } from "./PropertyDetailFields";
import {
  buildInfathUploadModel,
  copyInfathText,
  downloadInfathDocument,
} from "../../lib/prototype/infath-upload-model";
import type {
  InfathUploadAttachment,
  InfathUploadField,
  InfathUploadSection,
} from "../../lib/prototype/infath-upload-types";
import type { PropertyDetailDocumentSection } from "../../lib/prototype/property-detail-documents";
import type { PropertyDetailPartySubmissionsMap } from "../../lib/prototype/property-detail-party-submissions";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

type CopyKey = string;

function InfazIcon({
  name,
  className,
}: {
  name:
    | "copy"
    | "check"
    | "download"
    | "chevron"
    | "paperclip"
    | "expand"
    | "collapse"
    | "file"
    | "appraisal"
    | "map"
    | "photo"
    | "plan"
    | "deed"
    | "key";
  className?: string;
}) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...common}>
          <path d="m16 6-8.5 8.5a3 3 0 1 0 4.24 4.24L20.24 10a5 5 0 0 0-7.07-7.07L5.5 10.5" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="M15 3h6v6" />
          <path d="m21 3-7 7" />
          <path d="M9 21H3v-6" />
          <path d="m3 21 7-7" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common}>
          <path d="M4 14h6v6" />
          <path d="m10 20-7-7" />
          <path d="M20 10h-6V4" />
          <path d="m14 4 7 7" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
    case "appraisal":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2Z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        </svg>
      );
    case "photo":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 17-5-5-4 4-2-2-5 5" />
        </svg>
      );
    case "plan":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 10h16" />
          <path d="M10 4v16" />
        </svg>
      );
    case "deed":
      return (
        <svg {...common}>
          <path d="M12 3 4 7v6c0 4.4 3.6 8 8 8s8-3.6 8-8V7Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11.5 12.5 9.5 10.5" />
          <path d="M13 8h5" />
          <path d="M16 5v6" />
        </svg>
      );
    default:
      return null;
  }
}

function attachmentIcon(item: InfathUploadAttachment) {
  switch (item.id) {
    case "case-study":
      return "file";
    case "appraisal":
      return "appraisal";
    case "survey":
      return "map";
    case "interior-photos":
    case "exterior-photos":
      return "photo";
    case "plan":
      return "plan";
    case "deed":
      return "deed";
    case "keys-proof":
      return "key";
    default:
      return "file";
  }
}

function CopyButton({
  done,
  file,
  title,
  onClick,
}: {
  done?: boolean;
  file?: boolean;
  title: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="default"
      className={cn(
        "h-8 w-8 shrink-0 p-0",
        done && "border-success bg-success-bg text-success-text hover:bg-success-bg",
      )}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {done ? (
        <InfazIcon name="check" />
      ) : file ? (
        <InfazIcon name="download" />
      ) : (
        <InfazIcon name="copy" />
      )}
    </Button>
  );
}

function InfathFieldRow({
  field,
  isRefSection,
  copied,
  onCopy,
  onDownload,
}: {
  field: InfathUploadField;
  isRefSection: boolean;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const state = field.state ?? "";
  const hasValue = Boolean(field.value?.trim()) && field.value !== "—";
  const isSelect = field.type === "sel";
  const isAuto = field.type === "auto";
  const isRef = field.type === "ref";
  const isFile = field.type === "file";

  let action = null;
  if (isFile && hasValue) {
    action = <CopyButton file title="تحميل المرفق" onClick={onDownload} />;
  } else if (!isSelect && !isAuto && !isRef && hasValue) {
    action = <CopyButton done={copied} title="نسخ" onClick={onCopy} />;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-DEFAULT)] border border-border bg-surface px-3 py-2.5",
        !isRefSection && state === "cf" && "border-success/40 bg-success-bg/40",
        !isRefSection && state === "un" && "border-warning/40 bg-warning-bg/30",
        copied && "border-primary/40 bg-info-bg/50",
        isRef && "border-dashed bg-surface-2",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-semibold text-text-2">{field.label}</div>
        <div>
          {hasValue ? (
            <div className="text-[13px] font-medium text-text">
              {field.type === "file" ? (
                <bdi dir="ltr" className={ltrValueClass}>
                  {field.value}
                </bdi>
              ) : (
                field.value
              )}
            </div>
          ) : (
            <div className="text-[13px] text-text-3">— غير مُدخل —</div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

function InfathAreaBlock({
  field,
  copied,
  onCopy,
}: {
  field: InfathUploadField;
  copied: boolean;
  onCopy: () => void;
}) {
  const hasValue = Boolean(field.value?.trim()) && field.value !== "—";

  return (
    <div className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-3">
      {field.label ? (
        <div className="mb-2">
          <span className="text-[11px] font-semibold text-text-2">{field.label}</span>
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text">
          {hasValue ? field.value : "— غير مُدخل —"}
        </div>
        {hasValue ? (
          <CopyButton done={copied} title="نسخ" onClick={onCopy} />
        ) : null}
      </div>
    </div>
  );
}

function InfathSectionBlock({
  section,
  collapsed,
  copiedKeys,
  onToggle,
  onCopyField,
  onCopyArea,
  onDownloadFile,
}: {
  section: InfathUploadSection;
  collapsed: boolean;
  copiedKeys: Set<CopyKey>;
  onToggle: () => void;
  onCopyField: (key: CopyKey, text: string) => void;
  onCopyArea: (key: CopyKey, text: string) => void;
  onDownloadFile: (fileName: string) => void;
}) {
  const isRef = Boolean(section.conditional);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-DEFAULT)] border border-border bg-surface",
        isRef && "border-dashed bg-surface-2",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 border-0 bg-transparent px-3.5 py-3 text-start font-[inherit] text-inherit"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-2">
          {section.num}
        </span>
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold text-text">
          {section.title}
        </h3>
        {section.badge ? (
          <Badge
            tone={isRef ? "default" : "primary"}
            className="text-[10px] font-medium"
          >
            {section.badge}
          </Badge>
        ) : null}
        <InfazIcon
          name="chevron"
          className={cn(
            "shrink-0 text-text-3 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>

      {!collapsed && section.fields.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 px-3.5 pb-3.5 sm:grid-cols-2">
          {section.fields.map((field) => {
            const key = `f:${section.id}:${field.id}`;
            return (
              <InfathFieldRow
                key={key}
                field={field}
                isRefSection={isRef}
                copied={copiedKeys.has(key)}
                onCopy={() => onCopyField(key, field.value)}
                onDownload={() => onDownloadFile(field.value)}
              />
            );
          })}
        </div>
      ) : null}

      {!collapsed && section.areas.length > 0 ? (
        <div className="flex flex-col gap-2 px-3.5 pb-3.5">
          {section.areas.map((field) => {
            const key = `a:${section.id}:${field.id}`;
            return (
              <InfathAreaBlock
                key={key}
                field={field}
                copied={copiedKeys.has(key)}
                onCopy={() => onCopyArea(key, field.value)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function PropertyDetailEnfathUpload({
  record,
  property,
  task,
  parties,
  documentSections,
  loading,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  task: WorkflowTask | null;
  parties: PropertyDetailPartySubmissionsMap | null | undefined;
  documentSections: PropertyDetailDocumentSection[];
  loading?: boolean;
}) {
  const model = useMemo(
    () =>
      buildInfathUploadModel({
        record,
        property,
        parties: parties ?? null,
        documentSections,
      }),
    [record, property, parties, documentSections],
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [copiedKeys, setCopiedKeys] = useState<Set<CopyKey>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedCollapseRef = useRef(false);

  useEffect(() => {
    if (initializedCollapseRef.current) return;
    initializedCollapseRef.current = true;
    setCollapsedSections(
      new Set(
        model.sections.filter((section) => section.conditional).map((s) => s.id),
      ),
    );
  }, [model.sections]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const markCopied = useCallback(
    (key: CopyKey, text: string) => {
      setCopiedKeys((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      const preview = text.length > 34 ? `${text.slice(0, 34)}…` : text;
      showToast(`تم النسخ: ${preview}`);
    },
    [showToast],
  );

  const handleCopyField = useCallback(
    async (key: CopyKey, text: string) => {
      await copyInfathText(text);
      markCopied(key, text);
    },
    [markCopied],
  );

  const handleCopyArea = useCallback(
    async (key: CopyKey, text: string) => {
      await copyInfathText(text);
      markCopied(key, text);
    },
    [markCopied],
  );

  const handleDownloadFile = useCallback(
    (fileName: string) => {
      const allDocs = documentSections.flatMap((s) => s.documents);
      const doc =
        model.attachments
          .map((a) => a.document)
          .find((d) => d && (d.fileName === fileName || d.name === fileName)) ??
        allDocs.find(
          (d) => d.fileName === fileName || d.name === fileName,
        );
      if (doc?.dataUrl) {
        downloadInfathDocument(doc);
        showToast(`جارٍ تحميل: ${fileName}`);
      } else {
        showToast(`لا يتوفر ملف للتحميل: ${fileName}`);
      }
    },
    [documentSections, model.attachments, showToast],
  );

  const handleDownloadAll = useCallback(() => {
    const ready = model.attachments.filter((a) => a.document?.dataUrl);
    if (ready.length === 0) {
      showToast("لا توجد مرفقات جاهزة للتحميل");
      return;
    }
    for (const item of ready) {
      downloadInfathDocument(item.document);
    }
    showToast(`جارٍ تحميل كل المرفقات…`);
  }, [model.attachments, showToast]);

  const setAllCollapsed = useCallback(
    (collapse: boolean) => {
      if (collapse) {
        setCollapsedSections(
          new Set(
            model.sections
              .filter((section) => !section.conditional)
              .map((section) => section.id),
          ),
        );
      } else {
        setCollapsedSections(
          new Set(
            model.sections
              .filter((section) => section.conditional)
              .map((section) => section.id),
          ),
        );
      }
    },
    [model.sections],
  );

  if (!task) {
    return (
      <>
        <SectionHeader>الرفع على إنفاذ</SectionHeader>
        <EmptyState
          icon="⬆"
          title="لم تُبدأ دراسة الحالة"
          sub="يظهر مساعد الرفع على إنفاذ بعد بدء دراسة الحالة لهذا العقار."
        />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <SectionHeader>الرفع على إنفاذ</SectionHeader>
        <p className="m-0 text-xs text-text-3">جاري تحميل بيانات الرفع…</p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setAllCollapsed(false)}>
          <InfazIcon name="expand" />
          توسيع الكل
        </Button>
        <Button type="button" size="sm" onClick={() => setAllCollapsed(true)}>
          <InfazIcon name="collapse" />
          طي الكل
        </Button>
      </div>

      <section className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <InfazIcon name="paperclip" />
            مرفقات الرفع (PDF) — نزّلها ثم ارفعها في إنفاذ
          </div>
          <Button type="button" size="sm" variant="primary" onClick={handleDownloadAll}>
            <InfazIcon name="download" />
            تحميل الكل
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {model.attachments.map((item) => {
            const ready = Boolean(item.document?.dataUrl);
            const statusLabel = ready
              ? "جاهز"
              : item.conditional
                ? "عند الحاجة"
                : "غير متوفر";
            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 rounded-[var(--radius-DEFAULT)] border border-border bg-surface px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-DEFAULT)] bg-surface-2 text-text-2">
                  <InfazIcon name={attachmentIcon(item)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text">{item.name}</div>
                  <div className="text-[10px] text-text-3">← {item.infathTarget}</div>
                </div>
                <Badge
                  tone={ready ? "success" : "warning"}
                  className="shrink-0 text-[10px] font-medium"
                >
                  {statusLabel}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0"
                  disabled={!ready}
                  onClick={() => {
                    if (item.document?.dataUrl) {
                      downloadInfathDocument(item.document);
                      showToast(`جارٍ تحميل: ${item.name}`);
                    } else {
                      showToast(`غير متوفر: ${item.name}`);
                    }
                  }}
                  aria-label={`تحميل ${item.name}`}
                >
                  <InfazIcon name="download" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {model.sections.map((section) => (
          <InfathSectionBlock
            key={section.id}
            section={section}
            collapsed={collapsedSections.has(section.id)}
            copiedKeys={copiedKeys}
            onToggle={() =>
              setCollapsedSections((prev) => {
                const next = new Set(prev);
                if (next.has(section.id)) next.delete(section.id);
                else next.add(section.id);
                return next;
              })
            }
            onCopyField={handleCopyField}
            onCopyArea={handleCopyArea}
            onDownloadFile={handleDownloadFile}
          />
        ))}
      </div>

      <div
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 translate-y-4 items-center gap-2 rounded-full border border-success/30 bg-success-bg px-4 py-2 text-xs font-medium text-success-text opacity-0 shadow-lg transition-all",
          toast && "pointer-events-auto translate-y-0 opacity-100",
        )}
        role="status"
        aria-live="polite"
      >
        <InfazIcon name="check" />
        <span>{toast ?? ""}</span>
      </div>
    </div>
  );
}
