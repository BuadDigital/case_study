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
  useToast,
} from "@platform/design-system";
import { resetAllOperationalData } from "../lib/system-maintenance-api";
import { apiErrorMessage } from "../lib/settings-api-config";

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
      <section className="overflow-hidden rounded-xl border border-danger/25 bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <h2 className="m-0 text-[15px] font-bold text-heading">مسح بيانات التطوير</h2>
          <span className="rounded bg-danger-bg px-2 py-0.5 text-[10px] font-semibold text-danger-text">
            DEV فقط
          </span>
        </div>
        <div className="space-y-3 px-5 py-5 sm:px-6">
          <Note tone="warning" className="text-xs leading-relaxed">
            يحذف <strong>جميع أوامر العمل (PO)</strong> والمهام والمرفقات وبيانات النموذج
            التشغيلية. يبقي حسابات الإدارة (CDO ومديري الأنظمة) ويعيد المستخدمين
            التشغيليين تلقائياً.
          </Note>
          <Button
            type="button"
            variant="dangerOutline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            حذف جميع أوامر العمل
          </Button>
        </div>
      </section>

      {open ? (
        <ModalOverlay role="presentation" onClick={() => !loading && setOpen(false)}>
          <ModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-po-title"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <ModalTitle id="reset-po-title">تأكيد مسح أوامر العمل</ModalTitle>
            </ModalHeader>
            <ModalBody className="space-y-3 text-sm leading-relaxed text-text-2">
              <p>
                سيتم حذف <strong className="text-text">كل أوامر العمل</strong> وجميع
                العقارات والمهام المرتبطة. لا يمكن التراجع.
              </p>
              <p className="text-text-3">هل أنت متأكد؟</p>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void onConfirm()}
                disabled={loading}
              >
                {loading ? "جاري المسح…" : "نعم، متأكد — احذف الكل"}
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </Can>
  );
}
