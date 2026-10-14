"use client";

import { useState } from "react";
import { Can } from "@platform/app-shared/components/Can";
import {
  apiErrorMessage,
  notifyWorkOrdersChanged,
} from "@platform/app-shared/app-data/work-orders-api-config";
import {
  AppModal,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Note,
  useToast,
} from "@platform/ui-kit";
import { resetAllOperationalData } from "../lib/system-maintenance-api";

const DELETED = [
  "كل أوامر العمل (PO) وعقاراتها",
  "المهام والمرفقات",
  "بيانات النموذج التشغيلية",
] as const;

const KEPT = [
  "حسابات الإدارة (CDO ومديرو الأنظمة)",
  "المستخدمون التشغيليون — يُعادون تلقائياً",
] as const;

function ScopeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: "danger" | "success";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-text-2">{title}</span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[12.5px] text-text-1">
            <span
              aria-hidden
              className={
                tone === "danger"
                  ? "size-1.5 shrink-0 rounded-full bg-danger"
                  : "size-1.5 shrink-0 rounded-full bg-success"
              }
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
      const { workOrdersDeleted } = result.result;
      notifyWorkOrdersChanged();
      showToast(
        `تم المسح: حُذف ${workOrdersDeleted} أمر عمل، وأُعيد المستخدمون التشغيليون.`,
        "success",
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Can capability="reset-system-data">
      <Card>
        <CardHeader className="gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-bold">مسح بيانات التطوير</h2>
            <p className="m-0 mt-0.5 text-[11.5px] text-text-3">
              يعمل في بيئة التطوير فقط، ولا يُستخدم في الإنتاج.
            </p>
          </div>
          <Badge tone="danger" className="text-[10.5px]">
            بيئة التطوير
          </Badge>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ScopeList title="يُحذف" items={DELETED} tone="danger" />
            <ScopeList title="يبقى" items={KEPT} tone="success" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
            <p className="m-0 text-[11.5px] text-text-3">
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            <Button
              type="button"
              variant="dangerOutline"
              showActionToast={false}
              onClick={() => setOpen(true)}
            >
              حذف جميع أوامر العمل
            </Button>
          </div>
        </CardBody>
      </Card>

      <AppModal
        open={open}
        title="تأكيد مسح بيانات التطوير"
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        maxWidthPx={460}
        look="ops-html"
        footer={
          <div className="flex w-full justify-end gap-2.5">
            <Button
              variant="default"
              showActionToast={false}
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              showActionToast={false}
              loading={loading}
              onClick={() => void onConfirm()}
            >
              حذف الكل
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-text-2">
          <p className="m-0">
            سيُحذف <strong className="text-heading">كل أمر عمل</strong> مع عقاراته
            ومهامه ومرفقاته.
          </p>
          <Note tone="danger" className="mb-0 text-[12px]">
            لا يمكن التراجع عن هذا الإجراء.
          </Note>
        </div>
      </AppModal>
    </Can>
  );
}
