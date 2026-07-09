"use client";
import type { ReactNode } from "react";
import { Button, Card, CardBody } from "@platform/design-system";
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
  /** Parent handlers use runWithActionToast — skip duplicate global toast. */
  saveShowActionToast?: boolean;
  children: ReactNode;
}) {
  if (layout === "panel") {
    return (
        <Card className="m-0 flex h-full min-h-0 w-full flex-col self-stretch overflow-hidden border-0 shadow-none">
          <CardBody className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-surface">
          {children}
          {showFooter && variant !== "detail" ? (
            <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-6">
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
    <div className="flex min-h-0 flex-1 flex-col">
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
        showFooter={showFooter}
        fillViewport={!useDocumentScroll}
        scrollMode={scrollMode}
      >
        {children}
      </PoEditShell>
    </div>
  );
}
