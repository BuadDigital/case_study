"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  clientFieldPolicyFor,
  hasBourseDetailFields,
  isBourseInquiryIdentifier,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  deedExistsInPo,
  findPropertyInRecord,
} from "../../lib/app-data/po-intake-reads";
import {
  removePropertyFromPo,
  updatePropertyInPo,
} from "../../lib/app-data/po-intake-commands";
import {
  flushPropertyFieldAutosave,
  peekPropertyFieldAutosave,
  queuePropertyFieldAutosave,
} from "../../lib/app-data/property-field-autosave";
import {
  propertyToBourseRequest,
  propertyToDto,
} from "../../lib/app-data/po-intake-model";
import {
  hasFieldErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
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
} from "@platform/ui-kit";
import { PoPropertyBourseForm } from "./PoPropertyBourseForm";
import { PoPropertyEnfathForm } from "./PoPropertyDeedForm";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "../../lib/domain/po-intake/property-bourse-validation";
import {
  firstEnfathValidationMessage,
  mergePropertyEnfathValidation,
} from "../../lib/domain/po-intake/property-deed-validation";
import { contactsForApi } from "../../lib/domain/po-intake/property-validation";
import { scheduleScrollToFirstPoPropertyError } from "../../lib/domain/po-intake/po-field-error-targets";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canDeleteProperty, canEditProperty } from "../../lib/app-data/po-roles";
import { PoPropertyPartyDataCards } from "./PoPropertyPartyDataCards";
import { PoPropertySpecialistExtrasCard } from "./PoPropertySpecialistExtrasCard";
import { BuildingInventorySection } from "../field-inspection/BuildingInventorySection";

type EditSection = "enfath" | "bourse";

const SECTION_TITLES: Record<EditSection, string> = {
  enfath: "بيانات إنفاذ (الصك)",
  bourse: "بيانات الموقع والمساحة",
};

/** Fields changed since the last save, split by card: bourse-stage keys vs everything else. */
function sectionDirtyCount(
  section: EditSection,
  property: PoPropertyIntake,
  saved: PoPropertyIntake,
): number {
  const now = propertyToDto(property) as Record<string, unknown>;
  const was = propertyToDto(saved) as Record<string, unknown>;
  const bourseKeys = new Set(Object.keys(propertyToBourseRequest(property)));
  return Object.keys(now).filter(
    (key) =>
      bourseKeys.has(key) === (section === "bourse") &&
      JSON.stringify(now[key] ?? null) !== JSON.stringify(was[key] ?? null),
  ).length;
}

function SectionHeader({
  title,
  subtitle,
  dirtyCount,
  saving,
  disabled,
  onSave,
}: {
  title: string;
  subtitle?: string;
  dirtyCount: number;
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  return (
    <CardHeader>
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-bold">{title}</h2>
          {subtitle ? (
            <p className="m-0 mt-0.5 text-xs text-text-3">{subtitle}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={disabled || saving || dirtyCount === 0}
          showActionToast={false}
          onClick={onSave}
        >
          {dirtyCount > 0 ? `حفظ (${dirtyCount})` : "حفظ"}
        </Button>
      </div>
    </CardHeader>
  );
}

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
      <div className={cn("flex flex-col gap-4", showHeader && "mt-4")}>{children}</div>
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
  const [initialRecord, setInitialRecord] = useState<PoIntakeRecord | null>(null);
  const [property, setProperty] = useState<PoPropertyIntake | null>(null);
  /** Last server-committed copy — the dirty counters on each card compare against it. */
  const [savedProperty, setSavedProperty] = useState<PoPropertyIntake | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState<EditSection | null>(null);
  const { showToast } = useToast();
  const showDeleteProperty =
    canDeleteProperty(role) && Boolean(property && !property.isRemoved);

  useEffect(() => {
    let cancelled = false;
    const local = peekPropertyFieldAutosave(poNumber, propertyId);
    if (local) {
      setProperty(local);
    }
    void findPropertyInRecord(poNumber, propertyId).then((found) => {
      if (cancelled) return;
      const stillLocal = peekPropertyFieldAutosave(poNumber, propertyId);
      if (found) {
        setInitialRecord(found.record);
        setProperty(stillLocal ?? found.property);
        setSavedProperty(found.property);
      } else if (stillLocal) {
        setInitialRecord(null);
        setProperty(stillLocal);
        setSavedProperty(stillLocal);
      } else {
        setInitialRecord(null);
        setProperty(null);
        setSavedProperty(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      void flushPropertyFieldAutosave(poNumber, propertyId);
    };
  }, [poNumber, propertyId]);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        if (!p) return p;
        const next = { ...p, [key]: value };
        queuePropertyFieldAutosave(poNumber, propertyId, next);
        return next;
      });
      setFieldErrors((e) => {
        if (!e[String(key)]) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    },
    [poNumber, propertyId],
  );

  const replaceProperty = useCallback(
    (next: PoPropertyIntake) => {
      setProperty(next);
      setFieldErrors({});
      queuePropertyFieldAutosave(poNumber, propertyId, next);
    },
    [poNumber, propertyId],
  );

  if (loading) {
    return (
      <EditChrome title="تعديل العقار" onBack={onBackAction}>
        <InlineLoadingSkeleton />
      </EditChrome>
    );
  }

  if (!initialRecord || !property) {
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

  /** Each card validates only its own fields; the API still receives the whole property. */
  async function handleSaveSection(section: EditSection) {
    if (!initialRecord || !property) return;
    if (property.isRemoved) {
      setFormError("لا يمكن تعديل عقار محذوف");
      return;
    }

    const errors: FieldErrors =
      section === "enfath"
        ? mergeFieldErrors(
            mergePropertyEnfathValidation(
              property,
              initialRecord.assignmentType,
              clientFieldPolicyFor(initialRecord),
            ),
            {},
          )
        : property.bourseDataCompleted
          ? validatePropertyBourseFields(property)
          : {};

    if (
      section === "enfath" &&
      !isBourseInquiryIdentifier(property.identifierType) &&
      (await deedExistsInPo(poNumber, property.deedNumber, propertyId))
    ) {
      errors.deedNumber = "رقم الصك مسجّل مسبقاً في هذا أمر العمل";
    }

    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(
        section === "enfath"
          ? firstEnfathValidationMessage(errors)
          : firstBourseValidationMessage(errors),
      );
      scheduleScrollToFirstPoPropertyError(errors, property);
      return;
    }

    setSavingSection(section);
    setFormError(null);
    await flushPropertyFieldAutosave(poNumber, propertyId);

    const committed: PoPropertyIntake = {
      ...property,
      contacts: contactsForApi(property.contacts),
    };

    const result = await updatePropertyInPo(poNumber, propertyId, committed);
    setSavingSection(null);
    if (!result.ok) {
      setFormError(result.error);
      if (result.errors) {
        setFieldErrors(result.errors);
        scheduleScrollToFirstPoPropertyError(result.errors, property);
      }
      showToast(result.error, "error");
      return;
    }

    setSavedProperty(committed);
    setFieldErrors({});
    showToast(`تم حفظ ${SECTION_TITLES[section]}.`, "success");
    onSectionSavedAction?.();
  }

  async function handleDelete() {
    const reason = window.prompt("سبب الحذف (مطلوب):");
    if (reason == null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      showToast("سبب الحذف مطلوب", "error");
      return;
    }
    if (
      !window.confirm(
        "حذف هذا العقار؟ يبقى في قائمة أمر العمل مع سبب الحذف، ولا يمكن التراجع.",
      )
    ) {
      return;
    }
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
        <Card>
          <SectionHeader
            title={SECTION_TITLES.enfath}
            dirtyCount={
              savedProperty ? sectionDirtyCount("enfath", property, savedProperty) : 0
            }
            saving={savingSection === "enfath"}
            disabled={saving || savingSection !== null}
            onSave={() => void handleSaveSection("enfath")}
          />
          <CardBody>
            <PoPropertyEnfathForm
              property={property}
              assignmentType={initialRecord.assignmentType}
              fieldErrors={fieldErrors}
              onPatch={patchProperty}
              onReplaceProperty={replaceProperty}
              poNumber={poNumber}
              excludePoNumber={poNumber}
              fieldPolicy={clientFieldPolicyFor(initialRecord)}
            />
          </CardBody>
        </Card>

        <Card>
          <SectionHeader
            title={SECTION_TITLES.bourse}
            subtitle="المدينة والحي والمساحة والتصنيف والحدود — قابلة للتعديل هنا مباشرة"
            dirtyCount={
              savedProperty ? sectionDirtyCount("bourse", property, savedProperty) : 0
            }
            saving={savingSection === "bourse"}
            disabled={saving || savingSection !== null}
            onSave={() => void handleSaveSection("bourse")}
          />
          <CardBody>
            <PoPropertyBourseForm
              property={property}
              fieldErrors={fieldErrors}
              onPatch={patchProperty}
              poNumber={poNumber}
              showIntroNote={false}
            />
            {!property.bourseDataCompleted && !hasBourseDetailFields(property) ? (
              <Note tone="info" className="mt-3">
                بيانات البورصة الرسمية لم تُكتمل بعد — يمكنك تعبئة المساحة والموقع
                يدوياً هنا، أو إكمالها لاحقاً من «استعلام البورصة».
              </Note>
            ) : null}
          </CardBody>
        </Card>

        <PoPropertyPartyDataCards
          poNumber={poNumber}
          propertyId={propertyId}
          canEdit={canEditProperty(role)}
        />

        <PoPropertySpecialistExtrasCard
          poNumber={poNumber}
          propertyId={propertyId}
          canEdit={canEditProperty(role)}
        />

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <h2 className="m-0 text-sm font-bold">مكونات العقار</h2>
              <p className="m-0 mt-0.5 text-xs text-text-3">
                حصر الأدوار والأسوار والملاحق — مع اسم من كتب كل بند ومن عدّله
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <BuildingInventorySection
              poNumber={poNumber}
              propertyId={propertyId}
              disabled={!canEditProperty(role)}
              wide
            />
          </CardBody>
        </Card>
      </FormDensityProvider>
    </EditChrome>
  );
}
