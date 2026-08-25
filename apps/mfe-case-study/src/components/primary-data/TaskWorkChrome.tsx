"use client";
import type { ReactNode } from "react";
import { Button, Card, CardBody } from "@platform/ui-kit";
import { PoEditShell } from "@case-study/mfe/components/po-intake/PoEditShell";

export function TaskWorkChrome({
  layout = "page",
  title,
  subtitle,
  deedBadge,
  onClose,
  saving = false,
  saveLabel = "حفظ",
  onSave,
  showFooter = true,
  variant = "edit",
  footerExtra,
  scrollMode = "viewport",
  saveShowActionToast = false,
  showHeader = true,
  children,
}: {
  layout?: "page" | "panel";
  title: string;
  subtitle?: string;
  deedBadge?: string;
  onClose: () => void;
  saving?: boolean;
  saveLabel?: string;
  onSave: () => void;
  showFooter?: boolean;
  variant?: "edit" | "detail";
  footerExtra?: ReactNode;
  scrollMode?: "viewport" | "document";
  showHeader?: boolean;
  /** Parent handlers use runWithActionToast — skip duplicate global toast. */
  saveShowActionToast?: boolean;
  children: ReactNode;
}) {
  if (layout === "panel") {
    const footerVisible = showFooter && variant !== "detail";
    return (
      <Card className="m-0 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border-0 shadow-none">
        <CardBody className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface p-0">
          {showHeader ? (
            <div className="flex shrink-0 items-start gap-2.5 border-b border-border bg-surface-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="m-0 truncate text-[13.5px] font-bold text-heading">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="m-0 mt-0.5 truncate text-[11.5px] text-text-3">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {deedBadge ? (
                <span
                  dir="ltr"
                  className="mt-0.5 shrink-0 rounded-md bg-gold-soft px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-gold-d"
                >
                  {deedBadge}
                </span>
              ) : null}
              <button
                type="button"
                aria-label="إغلاق اللوحة"
                title="إغلاق"
                className="grid size-7 shrink-0 place-items-center rounded-md text-text-3 transition-colors hover:bg-row-hover hover:text-text-1"
                onClick={onClose}
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
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
          {footerVisible ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface px-4 py-3 shadow-[0_-4px_16px_rgba(15,52,96,0.08)]">
              {footerExtra}
              <Button
                type="button"
                variant="primary"
                loading={saving}
                disabled={saving}
                showActionToast={saveShowActionToast}
                actionLabel={saveLabel}
                onClick={onSave}
              >
                {saveLabel}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                إغلاق
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  const useDocumentScroll = scrollMode === "document";

  return (
    <div
      className={
        useDocumentScroll
          ? "flex w-full flex-col"
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      <PoEditShell
        title={title}
        subtitle={subtitle}
        saving={saving}
        onBack={onClose}
        onSave={onSave}
        saveLabel={saveLabel}
        saveShowActionToast={saveShowActionToast}
        footerExtra={footerExtra}
        variant={variant}
        showHeader={showHeader}
        showFooter={showFooter}
        fillViewport={!useDocumentScroll}
        scrollMode={scrollMode}
      >
        {children}
      </PoEditShell>
    </div>
  );
}
