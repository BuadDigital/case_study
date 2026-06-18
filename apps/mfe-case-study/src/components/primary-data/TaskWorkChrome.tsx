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
  children: ReactNode;
}) {
  if (layout === "panel") {
    return (
      <Card className="sticky top-3 m-0 max-h-[calc(100dvh-100px)] w-full self-start overflow-y-auto overscroll-contain shadow-none">
        <CardBody className="bg-surface">
          {children}
          {showFooter && variant !== "detail" ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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
          ) : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <PoEditShell
      title={title}
      subtitle={subtitle}
      saving={saving}
      onBack={onClose}
      onSave={onSave}
      saveLabel={saveLabel}
      footerExtra={footerExtra}
      variant={variant}
    >
      {children}
    </PoEditShell>
  );
}
