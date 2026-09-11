"use client";

/**
 * Brand identity screen — composition only. Workflow lives in `useBrandIdentityWorkflow`;
 * regions: `BrandIdentityAssetCards` (logo / stamp / signature), `BrandIdentityLetterheadCard`,
 * `BrandIdentityLetterheadZoom`, `BrandIdentityA4Preview` and the shared `ConfirmActionModal`.
 */

import { Can } from "@platform/app-shared/components/Can";
import { Button, Note, PageLoadingHint, PageShell } from "@platform/ui-kit";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { BrandA4Preview } from "./BrandIdentityA4Preview";
import {
  BrandLogoCard,
  BrandSignatureCard,
  BrandStampCard,
} from "./BrandIdentityAssetCards";
import { BrandLetterheadCard } from "./BrandIdentityLetterheadCard";
import { BrandLetterheadZoom } from "./BrandIdentityLetterheadZoom";
import { useBrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

export function BrandIdentityView() {
  const workflow = useBrandIdentityWorkflow();
  const { canEdit, loading, busy, error, previewOpen, zoom, modal, closeModal } = workflow;

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <PageLoadingHint className="py-20" />
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

      <div className="mx-0.5 mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
          المقاسات والهوامش تُحفظ تلقائيًا، والرفع والاستعادة بعد التأكيد — لا حاجة لزر حفظ،
          وكل حفظ يُقيَّد في سجل التدقيق.
        </p>
        <Button variant="default" size="sm" onClick={workflow.openPreview}>
          معاينة صفحة الاعتماد على A4
        </Button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <BrandLogoCard workflow={workflow} />
        <BrandStampCard workflow={workflow} />
        <BrandSignatureCard workflow={workflow} />
      </div>

      <div className="mt-4">
        <BrandLetterheadCard workflow={workflow} />
      </div>

      {zoom.open ? <BrandLetterheadZoom workflow={workflow} /> : null}
      {previewOpen ? <BrandA4Preview workflow={workflow} /> : null}

      <ConfirmActionModal modal={modal} titleId="brand-modal-title" onClose={closeModal} />

      <Can capability="manage-system-config">
        <span className="sr-only">{busy ? "جاري الحفظ" : ""}</span>
      </Can>
    </PageShell>
  );
}
