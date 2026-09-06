"use client";
import { useEffect } from "react";
import {
  BOURSE_INQUIRY_IDENTIFIER_STATUS,
  sanitizePropertyIdentifierInput,
  type AssignmentType,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  Badge,
  Card,
  CardBody,
  InfathSection,
  Label,
  Note,
} from "@platform/ui-kit";
import { PoContactEditor } from "./PoContactEditor";
import { PoPropertyEnfathBourseSections } from "./PoPropertyEnfathBourseSections";
import { PoPropertyEnfathDeedSections } from "./PoPropertyEnfathDeedSections";
import { PoPropertyEnfathDocumentFields } from "./PoPropertyEnfathDocumentFields";
import { usePriorDeedAutofill } from "./usePriorDeedAutofill";
import {
  contactsSectionTitle,
  derivedIdentifierType,
  enfathFormVisibility,
  priorFillStatusText,
  priorPoNotice,
  resolveAttachPo,
  resolvePriorExclusion,
  stageNoteText,
  type EnfathFieldsMode,
  type PoPropertyPatch,
} from "./po-property-enfath-form-state";

type Props = {
  property: PoPropertyIntake;
  assignmentType: AssignmentType;
  fieldErrors: FieldErrors;
  onPatch: PoPropertyPatch;
  /**
   * Preferred for full prior-deed populate (atomic replace).
   * Falls back to field-by-field onPatch when omitted.
   */
  onReplaceProperty?: (next: PoPropertyIntake) => void;
  poNumber?: string;
  excludePoNumber?: string;
  showStageNote?: boolean;
  /** Hide track-status / under-study UI for bourse inquiry (e.g. primary-data panel). */
  hideBoursePathStatus?: boolean;
  /** When set, only render identifier type selector (for bourse-inquiry fast path). */
  fieldsMode?: EnfathFieldsMode;
};

export function PoPropertyEnfathForm({
  property,
  assignmentType,
  fieldErrors,
  onPatch,
  onReplaceProperty,
  poNumber,
  excludePoNumber,
  showStageNote = true,
  hideBoursePathStatus = false,
  fieldsMode = "all",
}: Props) {
  const attachPo = resolveAttachPo(poNumber, excludePoNumber);
  const { priorExcludePo, priorExcludePropertyId } = resolvePriorExclusion({
    poNumber,
    excludePoNumber,
    propertyId: property.id,
  });

  const view = enfathFormVisibility({
    fieldsMode,
    assignmentType,
    identifierType: property.identifierType,
    realEstateRegNumber: property.realEstateRegNumber,
    hasRequestNumber: property.hasRequestNumber,
  });

  const patchDeedNumber = (value: string) => {
    onPatch(
      "deedNumber",
      sanitizePropertyIdentifierInput(value, "deed"),
    );
  };
  const patchRealEstateRegNumber = (value: string) => {
    onPatch(
      "realEstateRegNumber",
      sanitizePropertyIdentifierInput(value, "real_estate_reg"),
    );
  };

  useEffect(() => {
    if (fieldsMode !== "all") return;
    const nextType = derivedIdentifierType(property.realEstateRegNumber);
    if (property.identifierType === nextType) return;
    onPatch("identifierType", nextType);
  }, [
    fieldsMode,
    property.realEstateRegNumber,
    property.identifierType,
    onPatch,
  ]);

  const { priorPo, priorFilled } = usePriorDeedAutofill({
    property,
    attachPo,
    priorExcludePo,
    priorExcludePropertyId,
    onPatch,
    onReplaceProperty,
  });
  const priorNotice = priorPoNotice(property.deedNumber, priorPo);

  return (
    <>
      {showStageNote ? (
        <Note tone="info" className="mb-3">
          {stageNoteText(view.isBourseId, view.hasRealEstateReg)}
        </Note>
      ) : null}

      {view.isBourseId && !hideBoursePathStatus && !view.showBoursePrimary ? (
        <Card className="mb-3.5">
          <CardBody className="px-4 py-3.5">
            <Label className="mb-2 block text-[11px]">حالة المسار</Label>
            <Badge tone="warning" className="text-[13px] font-normal">
              {BOURSE_INQUIRY_IDENTIFIER_STATUS}
            </Badge>
          </CardBody>
        </Card>
      ) : view.hasRealEstateReg ? (
        <Note tone="success" className="mb-3">
          يمكن تجاوز استعلام البورصة والمتابعة مباشرة لتوزيع المعاملات.
        </Note>
      ) : null}

      {view.isIdentifierOnly ? null : (
      <>
      {priorNotice ? (
        <Note tone="success" className="mb-3">
          <strong>صك متكرر</strong> — وُجدت بيانات في أمر العمل «{priorNotice}».
          <span className="mt-1.5 block text-[12.5px] leading-relaxed text-text-2">
            {priorFillStatusText(priorFilled)}
          </span>
        </Note>
      ) : null}

      {view.showBoursePrimary ? (
        <PoPropertyEnfathBourseSections
          property={property}
          fieldErrors={fieldErrors}
          onPatch={onPatch}
          showCourt={view.showCourt}
          showRequestNumber={view.showRequestNumber}
          onDeedNumberChange={patchDeedNumber}
        />
      ) : view.showDeedFields ? (
        <PoPropertyEnfathDeedSections
          property={property}
          fieldErrors={fieldErrors}
          onPatch={onPatch}
          showCourt={view.showCourt}
          showRequestNumber={view.showRequestNumber}
          hasRealEstateReg={view.hasRealEstateReg}
          hasRequestNumber={view.hasRequestNumber}
          onDeedNumberChange={patchDeedNumber}
          onRealEstateRegNumberChange={patchRealEstateRegNumber}
        />
      ) : null}

      <PoPropertyEnfathDocumentFields
        property={property}
        fieldErrors={fieldErrors}
        onPatch={onPatch}
        attachPo={attachPo}
        showDelegationDoc={view.showDelegationDoc}
        showRegistryDoc={view.showRegistryDoc}
        showExtended={view.showExtended}
        showOtherDocs={view.showOtherDocs}
      />

      {view.showExtended ? (
      <div id="po_contacts_section" className="mt-5">
        <InfathSection title={contactsSectionTitle(view.contactsRequired)}>
        {fieldErrors._contacts ? (
          <Note tone="warn" className="mb-3">
            {fieldErrors._contacts}
          </Note>
        ) : null}
        <PoContactEditor
          contacts={property.contacts}
          errors={fieldErrors}
          onChange={(contacts) => onPatch("contacts", contacts)}
        />
        </InfathSection>
      </div>
      ) : null}
      </>
      )}
    </>
  );
}
