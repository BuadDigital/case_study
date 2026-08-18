"use client";

import { useState } from "react";
import { Can } from "@platform/app-shared/components/Can";
import { notifyWorkOrdersChanged } from "@platform/app-shared/prototype/work-orders-api-config";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  OperationalPanel,
  cn,
  useToast,
} from "@platform/ui-kit";
import { resetAllOperationalData } from "../lib/system-maintenance-api";
import { apiErrorMessage } from "../lib/settings-api-config";

function ResetGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const SCOPE_ITEMS = [
  "كل أوامر العمل (PO)",
  "المهام والمرفقات",
  "بيانات النموذج التشغيلية",
] as const;

export function DevSystemResetPanel() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      const result = await resetAllOperationalData();
      if (!result.ok) {
        const msg =
          result.kind === "not_found"
            ? "متاح في بيئة التطوير فقط."
            : apiErrorMessage(result.kind, "تعذّر مسح البيانات");
        showToast(msg, "error");
        return;
      }
      const { workOrdersDeleted, registeredUsersDeleted } = result.result;
      notifyWorkOrdersChanged();
      showToast(
        `تم المسح: ${workOrdersDeleted} أمر عمل — واستُعيد المستخدمون التشغيليون (${registeredUsersDeleted} حُذفوا ثم أُعيد seeding).`,
        "success",
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Can capability="reset-system-data">
      <OperationalPanel className="overflow-hidden border-danger/25">
        <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-border bg-danger-bg/35 px-4 py-3.5 sm:px-5">
          <span
            aria-hidden
            className="absolute inset-y-0 start-0 w-[3px] bg-danger"
          />
          <div className="flex min-w-0 items-start gap-3 pe-1">
            <span
              className={cn(
                "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
                "border border-danger/20 bg-surface text-danger-text",
              )}
            >
              <ResetGlyph className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-[14px] font-bold text-heading">
                مسح بيانات التطوير
              </h2>
              <p className="m-0 mt-0.5 text-[12px] leading-relaxed text-text-3">
                بيئة التطوير فقط — لا يُستخدم في الإنتاج
              </p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md border border-danger/25 bg-surface px-2 py-0.5",
              "text-[10px] font-bold tracking-wide text-danger-text",
            )}
          >
            DEV فقط
          </span>
        </div>

        <div className="space-y-3.5 px-4 py-4 sm:px-5">
          <Note tone="warn" className="mb-0 text-[12.5px] leading-relaxed">
            سيحذف{" "}
            <strong className="font-bold text-heading">
              جميع أوامر العمل (PO)
            </strong>{" "}
            والمهام والمرفقات وبيانات النموذج التشغيلية. يبقي حسابات الإدارة
            (CDO ومديري الأنظمة) ويعيد المستخدمين التشغيليين تلقائياً.
          </Note>

          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {SCOPE_ITEMS.map((item) => (
              <li
                key={item}
                className={cn(
                  "rounded-md border border-border bg-surface-2/80 px-2.5 py-1",
                  "text-[11px] font-medium text-text-2",
                )}
              >
                {item}
              </li>
            ))}
            <li
              className={cn(
                "rounded-md border border-success/25 bg-success-bg/60 px-2.5 py-1",
                "text-[11px] font-medium text-success-text",
              )}
            >
              حسابات الإدارة محفوظة
            </li>
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
            <p className="m-0 max-w-md text-[11px] leading-relaxed text-text-3">
              الإجراء لا يمكن التراجع عنه. يُنفَّذ عبر API التطوير فقط.
            </p>
            <Button
              type="button"
              variant="dangerOutline"
              size="sm"
              showActionToast={false}
              className="h-[38px] px-4 text-[13px] font-bold"
              onClick={() => setOpen(true)}
            >
              <ResetGlyph className="size-3.5" />
              حذف جميع أوامر العمل
            </Button>
          </div>
        </div>
      </OperationalPanel>

      {open ? (
        <ModalOverlay
          role="presentation"
          onClick={() => !loading && setOpen(false)}
        >
          <ModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-po-title"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader className="border-0 bg-ink text-white">
              <span
                className="grid size-7 place-items-center rounded-md bg-danger/20 text-danger"
                aria-hidden
              >
                <ResetGlyph className="size-3.5" />
              </span>
              <ModalTitle
                id="reset-po-title"
                className="text-start text-white"
              >
                تأكيد مسح أوامر العمل
              </ModalTitle>
            </ModalHeader>
            <ModalBody className="space-y-3 text-sm leading-relaxed text-text-2">
              <p className="m-0">
                سيتم حذف{" "}
                <strong className="text-text">كل أوامر العمل</strong> وجميع
                العقارات والمهام المرتبطة. لا يمكن التراجع.
              </p>
              <Note tone="danger" className="mb-0 text-xs">
                هل أنت متأكد من المتابعة؟
              </Note>
            </ModalBody>
            <ModalFooter className="justify-start gap-2">
              <Button
                type="button"
                variant="danger"
                loading={loading}
                showActionToast={false}
                className="h-[38px] px-4 text-[13px] font-bold"
                onClick={() => void onConfirm()}
              >
                نعم، متأكد — احذف الكل
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-[38px] px-4 text-[13px]"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                إلغاء
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </Can>
  );
}
