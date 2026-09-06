"use client";

/**
 * Brand identity screen — composition only. Workflow lives in
 * `useBrandIdentityWorkflow`; regions: `BrandIdentityAssetCards` (logo /
 * stamp / signature), `BrandIdentityLetterheadCard`, `BrandIdentityLetterheadZoom`
 * and the shared `ConfirmActionModal`.
 */

import { Can } from "@platform/app-shared/components/Can";
import { Note, PageShell, Spinner } from "@platform/ui-kit";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
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
  const { canEdit, loading, saving, error, lhZoom, modal, closeModal } = workflow;

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

      <p className="m-0 mx-0.5 mb-4 text-[11.5px] leading-relaxed text-text-3">
        التغييرات لا تسري إلا باعتماد كل مكوّن على حدة — والاعتماد يُقيَّد في سجل التدقيق.
      </p>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <BrandLogoCard workflow={workflow} />
        <BrandStampCard workflow={workflow} />
        <BrandSignatureCard workflow={workflow} />
      </div>

      <div className="mt-4">
        <BrandLetterheadCard workflow={workflow} />
      </div>

      {lhZoom ? <BrandLetterheadZoom workflow={workflow} /> : null}

      <ConfirmActionModal modal={modal} titleId="brand-modal-title" onClose={closeModal} />

      <Can capability="manage-system-config">
        <span className="sr-only">{saving ? "جاري الحفظ" : ""}</span>
      </Can>
    </PageShell>
  );
}
