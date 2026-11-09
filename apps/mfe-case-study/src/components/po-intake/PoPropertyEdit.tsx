"use client";

import { useState, type ReactNode } from "react";
import { removePropertyFromPo } from "../../lib/app-data/po-intake-commands";
import { REG_BACK } from "@platform/app-shared/registration/registration-labels";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormDensityProvider,
  InlineLoadingSkeleton,
  Note,
  PageShell,
  PageShellHeader,
  cn,
  useToast,
  confirmAction,
  promptAction,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  canDeleteProperty,
  canEditPropertyData,
} from "../../lib/app-data/po-roles";
import { PoPropertyPartyDataCards } from "./PoPropertyPartyDataCards";
import { PoPropertySpecialistExtrasCard } from "./PoPropertySpecialistExtrasCard";
import { SpecialistComponentsSection } from "./SpecialistComponentsSection";
import {
  PropertyIntakeBourseCard,
  PropertyIntakeEnfathCard,
  usePropertyIntakeEditor,
} from "./PropertyIntakeEditorCards";

function EditChrome({
  title,
  hideTitle = false,
  onBack,
  actions,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  /** Omit on the edit form itself — navigation lives in the top bar, so the header goes away. */
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const showHeader = Boolean(!hideTitle || onBack || actions);
  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {showHeader ? (
        <PageShellHeader
          title={title}
          hideTitle={hideTitle}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {onBack ? (
                <Button type="button" size="sm" onClick={onBack}>
                  {REG_BACK}
                </Button>
              ) : null}
            </div>
          }
        />
      ) : null}
      <div className={cn("flex flex-col gap-4", showHeader && "mt-4")}>
        {children}
      </div>
    </PageShell>
  );
}

export function PoPropertyEdit({
  poNumber,
  propertyId,
  onBackAction,
  onSavedAction,
  onSectionSavedAction,
  onDeletedAction,
}: {
  poNumber: string;
  propertyId: string;
  onBackAction: () => void;
  /** After delete (fallback when `onDeletedAction` is absent). */
  onSavedAction: () => void;
  /** After a card's «حفظ» — refresh caches; the page stays open. */
  onSectionSavedAction?: () => void;
  onDeletedAction?: () => void;
}) {
  const { role } = useAppAccess();
  const { showToast } = useToast();
  const editor = usePropertyIntakeEditor({
    poNumber,
    propertyId,
    onSectionSaved: onSectionSavedAction,
  });
  const { loading, record, property, formError, setFormError, savingSection } =
    editor;
  const [saving, setSaving] = useState(false);
  const showDeleteProperty =
    canDeleteProperty(role) && Boolean(property && !property.isRemoved);

  if (loading) {
    return (
      <EditChrome title="تعديل العقار" onBack={onBackAction}>
        <InlineLoadingSkeleton />
      </EditChrome>
    );
  }

  if (!record || !property) {
    return (
      <EditChrome title="تعديل العقار" onBack={onBackAction}>
        <Note tone="warn">لم يُعثر على العقار.</Note>
      </EditChrome>
    );
  }

  if (property.isRemoved) {
    return (
      <EditChrome
        title={`عقار محذوف — ${property.deedNumber || poNumber}`}
        onBack={onBackAction}
      >
        <Note tone="warn" role="alert">
          هذا العقار محذوف
          {property.removalReason.trim()
            ? ` — ${property.removalReason.trim()}`
            : ""}
          . لا يمكن تعديله.
        </Note>
      </EditChrome>
    );
  }

  async function handleDelete() {
    const trimmed = await promptAction({
      title: "حذف العقار",
      label: "سبب الحذف",
      required: true,
      confirmLabel: "متابعة",
      danger: true,
    });
    if (trimmed == null) return;
    const confirmed = await confirmAction({
      title: "حذف العقار",
      message:
        "حذف هذا العقار؟ يبقى في قائمة أمر العمل مع سبب الحذف، ولا يمكن التراجع.",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!confirmed) return;
    setSaving(true);
    const result = await removePropertyFromPo(poNumber, propertyId, trimmed);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      showToast(result.error, "error");
      return;
    }
    showToast("تم حذف العقار.", "success");
    if (onDeletedAction) onDeletedAction();
    else onSavedAction();
  }

  return (
    <EditChrome
      title="تعديل العقار"
      hideTitle
      actions={
        showDeleteProperty ? (
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="border-red/30 bg-transparent hover:bg-danger-bg/60"
            loading={saving}
            disabled={saving || savingSection !== null}
            onClick={() => void handleDelete()}
          >
            حذف العقار
          </Button>
        ) : null
      }
    >
      {formError ? <Note tone="warn">{formError}</Note> : null}

      <FormDensityProvider value="compact">
        <PropertyIntakeEnfathCard editor={editor} disabled={saving} />
        <PropertyIntakeBourseCard editor={editor} disabled={saving} />

        <PoPropertyPartyDataCards
          poNumber={poNumber}
          propertyId={propertyId}
          canEdit={canEditPropertyData(role)}
        />

        <PoPropertySpecialistExtrasCard
          poNumber={poNumber}
          propertyId={propertyId}
          canEdit={canEditPropertyData(role)}
        />

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <h2 className="m-0 text-sm font-bold">مكونات العقار</h2>
              <p className="m-0 mt-0.5 text-xs text-text-3">
                نص المكونات للتقرير وجدول البنود الذي ينتقل لبنود التكلفة عند
                المقيّم
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <SpecialistComponentsSection
              poNumber={poNumber}
              propertyId={propertyId}
              disabled={!canEditPropertyData(role)}
            />
          </CardBody>
        </Card>
      </FormDensityProvider>
    </EditChrome>
  );
}
