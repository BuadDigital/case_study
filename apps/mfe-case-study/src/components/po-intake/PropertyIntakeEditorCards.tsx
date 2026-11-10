"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clientFieldPolicyFor,
  formatPropertyDeedDisplay,
  hasBourseDetailFields,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  deedExistsInPo,
  findPropertyInRecord,
} from "../../lib/app-data/po-intake-reads";
import { updatePropertyInPo } from "../../lib/app-data/po-intake-commands";
import {
  cancelPropertyFieldAutosave,
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
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Note,
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

export type IntakeSection = "enfath" | "bourse";

const SECTION_TITLES: Record<IntakeSection, string> = {
  enfath: "بيانات إنفاذ (الصك)",
  bourse: "بيانات الموقع والمساحة",
};

/** Fields changed since the last save, split by card: bourse-stage keys vs everything else. */
function sectionDirtyCount(
  section: IntakeSection,
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

/**
 * The editing state of a deed's intake data (the Enfaz card and the bourse card) — one owner of
 * the property for both cards.
 *
 * How it works: shows unsaved local edits at once, then loads the server copy; every change queues
 * the local autosave; `saveSection` validates only that card's fields and sends the whole property;
 * the dirty counters compare with the last server copy.
 * Edge cases: a deed number already used in the work order is refused before the save; a removed
 * property cannot be saved. Extracted 2026-11-05 from `PoPropertyEdit` so the work page edits the
 * same cards with the same rules.
 */
export function usePropertyIntakeEditor({
  poNumber,
  propertyId,
  onSectionSaved,
}: {
  poNumber: string;
  propertyId: string;
  onSectionSaved?: () => void;
}) {
  const { showToast } = useToast();
  const [record, setRecord] = useState<PoIntakeRecord | null>(null);
  const [property, setProperty] = useState<PoPropertyIntake | null>(null);
  /** Last server-committed copy — the dirty counters on each card compare against it. */
  const [savedProperty, setSavedProperty] = useState<PoPropertyIntake | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<IntakeSection | null>(
    null,
  );

  // Unsaved local edits of this property show at once (during render); the server copy follows.
  const propertyKey = `${poNumber}\0${propertyId}`;
  const [peekedFor, setPeekedFor] = useState<string | null>(null);
  if (peekedFor !== propertyKey) {
    setPeekedFor(propertyKey);
    const local = peekPropertyFieldAutosave(poNumber, propertyId);
    if (local) setProperty(local);
  }

  useEffect(() => {
    let cancelled = false;
    void findPropertyInRecord(poNumber, propertyId)
      .then((found) => {
        if (cancelled) return;
        const stillLocal = peekPropertyFieldAutosave(
          poNumber,
          propertyId,
          found?.property.updatedAtUtc,
        );
        if (found) {
          setRecord(found.record);
          setProperty(stillLocal ?? found.property);
          setSavedProperty(found.property);
        } else {
          setRecord(null);
          setProperty(stillLocal ?? null);
          setSavedProperty(stillLocal ?? null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "تعذّر تحميل بيانات العقار";
        setFormError(message);
        showToast(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      void flushPropertyFieldAutosave(poNumber, propertyId);
    };
  }, [poNumber, propertyId, showToast]);

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

  /** Each card validates only its own fields; the API still receives the whole property. */
  async function saveSection(section: IntakeSection) {
    if (!record || !property) return;
    if (property.isRemoved) {
      setFormError("لا يمكن تعديل عقار محذوف");
      return;
    }
    const errors: FieldErrors =
      section === "enfath"
        ? mergeFieldErrors(
            mergePropertyEnfathValidation(
              property,
              record.assignmentType,
              clientFieldPolicyFor(record),
            ),
            {},
          )
        : property.bourseDataCompleted
          ? validatePropertyBourseFields(property)
          : {};
    if (
      section === "enfath" &&
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
    cancelPropertyFieldAutosave(poNumber, propertyId);
    const saved = result.data ?? committed;
    setProperty((current) =>
      current
        ? {
            ...current,
            updatedAtUtc: saved.updatedAtUtc || current.updatedAtUtc,
          }
        : current,
    );
    setSavedProperty(saved);
    setFieldErrors({});
    showToast(`تم حفظ ${SECTION_TITLES[section]}.`, "success");
    onSectionSaved?.();
  }

  const dirtyCount = (section: IntakeSection) =>
    property && savedProperty
      ? sectionDirtyCount(section, property, savedProperty)
      : 0;

  return {
    poNumber,
    loading,
    record,
    property,
    fieldErrors,
    formError,
    setFormError,
    savingSection,
    patchProperty,
    replaceProperty,
    saveSection,
    dirtyCount,
  };
}

export type PropertyIntakeEditor = ReturnType<typeof usePropertyIntakeEditor>;

/** A card header with the card's «حفظ (n)» button — n is the fields changed since the last save. */
export function IntakeSectionHeader({
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

/**
 * The Enfaz (deed) card of the intake editor. `disabled` blocks its save (another save running).
 * `bare` (the two frame pages, Omar 2026-11-10): the form alone — no card header, no save button; the
 * fields autosave to the server as they change.
 */
export function PropertyIntakeEnfathCard({
  editor,
  disabled = false,
  bare = false,
}: {
  editor: PropertyIntakeEditor;
  disabled?: boolean;
  bare?: boolean;
}) {
  const { property, record } = editor;
  if (!property || !record) return null;
  const deed = formatPropertyDeedDisplay(property);
  if (bare) {
    return (
      <PoPropertyEnfathForm
        property={property}
        assignmentType={record.assignmentType}
        fieldErrors={editor.fieldErrors}
        onPatch={editor.patchProperty}
        onReplaceProperty={editor.replaceProperty}
        poNumber={editor.poNumber}
        excludePoNumber={editor.poNumber}
        fieldPolicy={clientFieldPolicyFor(record)}
      />
    );
  }
  return (
    <Card>
      <IntakeSectionHeader
        title={
          deed ? `${SECTION_TITLES.enfath} — ${deed}` : SECTION_TITLES.enfath
        }
        dirtyCount={editor.dirtyCount("enfath")}
        saving={editor.savingSection === "enfath"}
        disabled={disabled || editor.savingSection !== null}
        onSave={() => void editor.saveSection("enfath")}
      />
      <CardBody>
        <PoPropertyEnfathForm
          property={property}
          assignmentType={record.assignmentType}
          fieldErrors={editor.fieldErrors}
          onPatch={editor.patchProperty}
          onReplaceProperty={editor.replaceProperty}
          poNumber={editor.poNumber}
          excludePoNumber={editor.poNumber}
          fieldPolicy={clientFieldPolicyFor(record)}
        />
      </CardBody>
    </Card>
  );
}

/**
 * The bourse (location, area, owners, boundaries) card of the intake editor. `bare` (the two frame
 * pages): the form alone, autosaved — no card header, no save button.
 */
export function PropertyIntakeBourseCard({
  editor,
  disabled = false,
  bare = false,
}: {
  editor: PropertyIntakeEditor;
  disabled?: boolean;
  bare?: boolean;
}) {
  const { property } = editor;
  if (!property) return null;
  if (bare) {
    return (
      <PoPropertyBourseForm
        property={property}
        fieldErrors={editor.fieldErrors}
        onPatch={editor.patchProperty}
        poNumber={editor.poNumber}
        showIntroNote={false}
      />
    );
  }
  return (
    <Card>
      <IntakeSectionHeader
        title={SECTION_TITLES.bourse}
        subtitle="المدينة والحي والمساحة والتصنيف والحدود — قابلة للتعديل هنا مباشرة"
        dirtyCount={editor.dirtyCount("bourse")}
        saving={editor.savingSection === "bourse"}
        disabled={disabled || editor.savingSection !== null}
        onSave={() => void editor.saveSection("bourse")}
      />
      <CardBody>
        <PoPropertyBourseForm
          property={property}
          fieldErrors={editor.fieldErrors}
          onPatch={editor.patchProperty}
          poNumber={editor.poNumber}
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
  );
}
