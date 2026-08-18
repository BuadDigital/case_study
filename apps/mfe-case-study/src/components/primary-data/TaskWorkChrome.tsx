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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
          {footerVisible ? (
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-surface px-4 py-3 shadow-[0_-4px_16px_rgba(15,52,96,0.08)]">
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
