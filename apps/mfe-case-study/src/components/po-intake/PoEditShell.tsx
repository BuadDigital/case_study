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
  footerExtra,
  variant = "edit",
  children,
}: {
  title: string;
  subtitle?: string;
  isDirty?: boolean;
  saving?: boolean;
  onBack: () => void;
  onSave: () => void;
  saveLabel?: string;
  footerExtra?: ReactNode;
  variant?: "edit" | "detail";
  children: ReactNode;
}) {
  function handleBack() {
    if (isDirty && !window.confirm(UNSAVED_CONFIRM_MSG)) return;
    onBack();
  }

  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-stretch">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface",
            variant === "detail" && "bg-surface",
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-4">
            {children}
          </div>
          {variant !== "detail" ? (
            <footer className="flex shrink-0 justify-start border-t border-border bg-surface px-4 py-3">
              <div className="flex flex-row flex-wrap items-center gap-2">
                {footerExtra}
                <Button
                  type="button"
                  variant="primary"
                  loading={saving}
                  disabled={saving}
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
