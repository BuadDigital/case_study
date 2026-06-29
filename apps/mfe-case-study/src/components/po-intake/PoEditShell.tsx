"use client";

import type { ReactNode } from "react";
import { REG_BACK } from "@platform/app-shared/registration/registration-labels";
import { UNSAVED_CONFIRM_MSG } from "@platform/app-shared/registration/registration-utils";
import { Button, cn } from "@platform/design-system";

export function PoEditShell({
  title,
  subtitle,
  isDirty,
  saving,
  onBack,
  onSave,
  saveLabel = "حفظ التعديلات",
  saveShowActionToast = true,
  footerExtra,
  variant = "edit",
  showFooter = true,
  fillViewport = false,
  scrollMode = "viewport",
  children,
}: {
  title: string;
  subtitle?: string;
  isDirty?: boolean;
  saving?: boolean;
  onBack: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveShowActionToast?: boolean;
  footerExtra?: ReactNode;
  variant?: "edit" | "detail";
  showFooter?: boolean;
  /** يملأ ارتفاع منطقة المحتوى — تمرير واحد داخل النموذج. */
  fillViewport?: boolean;
  /** document = تمرير الصفحة بالكامل (مناسب لـ /property-inspection/[taskId]). */
  scrollMode?: "viewport" | "document";
  children: ReactNode;
}) {
  function handleBack() {
    if (isDirty && !window.confirm(UNSAVED_CONFIRM_MSG)) return;
    onBack();
  }

  const showShellFooter = showFooter && variant !== "detail";
  const documentScroll = scrollMode === "document";
  const viewportScroll = fillViewport && !documentScroll;

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden",
        viewportScroll ? "min-h-0 flex-1" : "min-h-0",
      )}
    >
      <div
        className={cn(
          "flex items-stretch",
          documentScroll ? "min-h-0 w-full flex-col" : "min-h-0 flex-1",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col",
            viewportScroll
              ? "min-h-0 flex-1 overflow-hidden bg-bg"
              : cn(
                  "bg-surface",
                  documentScroll
                    ? "w-full"
                    : "min-h-0 flex-1 overflow-hidden",
                ),
            variant === "detail" && !viewportScroll && "bg-surface",
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button type="button" size="sm" onClick={handleBack}>
                {REG_BACK}
              </Button>
              <div className="min-w-0">
                <h1 className="m-0 text-[1.05rem] font-bold leading-snug text-text">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="m-0 mt-0.5 text-xs text-text-3">{subtitle}</p>
                ) : null}
              </div>
            </div>
          </header>
          <div
            className={cn(
              documentScroll
                ? "px-4 py-4 pb-6"
                : "inspector-work-scroll min-h-0 flex-1 overflow-y-auto bg-bg px-4 pb-4",
            )}
            dir="rtl"
          >
            <div dir="rtl" className={documentScroll ? undefined : "min-h-0"}>
              {children}
            </div>
          </div>
          {showShellFooter ? (
            <footer className="flex shrink-0 justify-start border-t border-border bg-surface px-4 py-3">
              <div className="flex flex-row flex-wrap items-center gap-2">
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
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
