"use client";

/**
 * Valuers roster screen — composition only. Workflow lives in
 * `useValuersRosterWorkflow`; `ValuersRosterTable` renders the rows and the
 * shared `ConfirmActionModal` handles every confirm step.
 */

import { Button, Input, Note, PageShell, Spinner } from "@platform/ui-kit";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { addValuerBlockedTitle } from "./valuers-roster-state";
import { useValuersRosterWorkflow } from "./useValuersRosterWorkflow";
import { ValuersRosterTable } from "./ValuersRosterTable";

export function ValuersRosterView() {
  const workflow = useValuersRosterWorkflow();
  const {
    canEdit,
    loading,
    saving,
    dirty,
    error,
    certMsg,
    query,
    setQuery,
    editingId,
    canAddValuer,
    tryAddValuer,
    modal,
    closeModal,
  } = workflow;

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <div className="flex items-center justify-center gap-2 py-20 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري التحميل…</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}
      {certMsg ? (
        <Note tone="danger" className="mt-0">
          {certMsg}
        </Note>
      ) : null}
      <Note className="mt-0">
        هذا هو السجل الأساسي للمقيّمين — «المشاركون في إعداد التقرير» و«بيانات المقيم المعتمد» في
        قوائم التقييم يُختاران من هذه القائمة.
      </Note>

      <div className="mb-3 mt-3 flex flex-wrap gap-2.5">
        <Input
          className="h-[34px] max-w-[260px] py-0 text-[12.5px] leading-[34px]"
          placeholder="بحث بالاسم…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {canEdit ? (
          <Button
            variant="default"
            disabled={!canAddValuer}
            title={addValuerBlockedTitle(canAddValuer, editingId)}
            onClick={() => tryAddValuer()}
          >
            إضافة مقيّم
          </Button>
        ) : null}
      </div>

      <ValuersRosterTable workflow={workflow} />
      <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
        «تم» و«تعطيل» و«×» تحفظ مباشرة بعد التأكيد — لا حاجة لزر حفظ منفصل. أكمل بيانات كل مقيّم
        فعّال قبل إضافة آخر. دور «مقيم معتمد» يُسند مرة ويُحجز.
      </p>

      {saving ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-text-3">
          <Spinner />
          جاري الحفظ…
        </div>
      ) : dirty ? (
        <p className="mt-3 text-end text-[11.5px] text-amber-text">
          تعديلات معلّقة — اضغط «تم» لحفظ الصف.
        </p>
      ) : null}

      <ConfirmActionModal modal={modal} titleId="valuers-modal-title" onClose={closeModal} />
    </PageShell>
  );
}
