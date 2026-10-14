"use client";
import { useEffect } from "react";
import {
  sanitizePropertyIdentifierInput,
  type AssignmentType,
  type ClientFieldPolicy,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import { InfathSection, Note } from "@platform/ui-kit";
import { PoContactEditor } from "./PoContactEditor";
import { PoPropertyEnfathDeedSections } from "./PoPropertyDeedIdentifierSections";
import { PoPropertyEnfathDocumentFields } from "./PoPropertyDeedDocumentFields";
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
  type PoPropertyPatch,
} from "./po-property-deed-form-state";

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
  /** Which fields this client relationship requires — e.g. Nabr skips قرار الإسناد و اسم المالك. */
  fieldPolicy?: ClientFieldPolicy;
  showStageNote?: boolean;
};

export function PoPropertyEnfathForm({
  property,
  assignmentType,
  fieldErrors,
  onPatch,
  onReplaceProperty,
  poNumber,
  excludePoNumber,
  fieldPolicy,
  showStageNote = true,
}: Props) {
  const attachPo = resolveAttachPo(poNumber, excludePoNumber);
  const { priorExcludePo, priorExcludePropertyId } = resolvePriorExclusion({
    poNumber,
    excludePoNumber,
    propertyId: property.id,
  });

  const view = enfathFormVisibility({
    assignmentType,
    realEstateRegNumber: property.realEstateRegNumber,
    hasRequestNumber: property.hasRequestNumber,
    fieldPolicy,
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

  // Also heals stored rows still carrying the «bourse_inquiry» type.
  useEffect(() => {
    const nextType = derivedIdentifierType(property.realEstateRegNumber);
    if (property.identifierType === nextType) return;
    onPatch("identifierType", nextType);
  }, [property.realEstateRegNumber, property.identifierType, onPatch]);

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
          {stageNoteText()}
        </Note>
      ) : null}

      {priorNotice ? (
        <Note tone="success" className="mb-3">
          <strong>صك متكرر</strong> — وُجدت بيانات في أمر العمل «{priorNotice}».
          <span className="mt-1.5 block text-[12.5px] leading-relaxed text-text-2">
            {priorFillStatusText(priorFilled)}
          </span>
        </Note>
      ) : null}

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
        fieldPolicy={fieldPolicy}
      />

      <PoPropertyEnfathDocumentFields
        property={property}
        fieldErrors={fieldErrors}
        onPatch={onPatch}
        attachPo={attachPo}
        showDelegationDoc={view.showDelegationDoc}
        showRegistryDoc={view.showRegistryDoc}
        showExtended={view.showExtended}
        showOtherDocs={view.showOtherDocs}
        showAssignmentDoc={view.showAssignmentDoc}
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
  );
}
