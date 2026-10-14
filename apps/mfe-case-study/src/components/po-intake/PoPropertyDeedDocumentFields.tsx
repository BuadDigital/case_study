"use client";

/**
 * Enfath form — property document uploads (delegation, registry, decree, deed
 * image, other). Each field writes its file name only after the attachments
 * service stored the file (see `usePropertyDocUpload`); a failed upload leaves
 * the field empty instead of a name nobody can open.
 */

import { COMPACT_FORM_GRID_CLASS, cn, useFormDensity, useToast } from "@platform/ui-kit";
import {
  cacheAssignmentDoc,
  cacheDeedOwnershipDoc,
  cacheDelegationDoc,
  cacheRegistryDoc,
  clearCachedPropertyDoc,
  removeCachedPropertyDoc,
} from "../../lib/app-data/assignment-doc-attachments";
import { PoPropertyUnlistedDocumentField } from "./PoPropertyUnlistedDocumentField";
import { PropertyFileUploadField } from "./PropertyFileUploadField";
import {
  withoutFileName,
  type EnfathSectionProps,
} from "./po-property-deed-form-state";
import { usePropertyDocUpload } from "./use-property-doc-upload";

export function PoPropertyEnfathDocumentFields({
  property,
  fieldErrors,
  onPatch,
  attachPo,
  showDelegationDoc,
  showRegistryDoc,
  showExtended,
  showOtherDocs,
  showAssignmentDoc,
}: EnfathSectionProps & {
  attachPo: string;
  showDelegationDoc: boolean;
  showRegistryDoc: boolean;
  showExtended: boolean;
  showOtherDocs: boolean;
  /** Nabr transactions have no قرار إسناد. */
  showAssignmentDoc: boolean;
}) {
  const { showToast } = useToast();
  const compact = useFormDensity() === "compact";
  const upload = usePropertyDocUpload();

  return (
    <div className={cn(compact ? cn(COMPACT_FORM_GRID_CLASS, "items-start") : "contents")}>
      {showDelegationDoc ? (
        <PropertyFileUploadField
          id={`delegation_${property.id}`}
          label="خطاب التكليف *"
          fileNames={property.delegationLetterFileNames}
          error={fieldErrors.delegationLetterFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="delegation"
          multiple
          maxFiles={1}
          uploading={upload.isUploading("delegation")}
          onTooManyFiles={() =>
            showToast("ممنوع إدخال أكثر من مستند واحد", "error")
          }
          onUpload={(file) => {
            if (!attachPo) {
              onPatch("delegationLetterFileNames", [file.name]);
              return;
            }
            void upload.run(
              "delegation",
              file,
              () => cacheDelegationDoc(attachPo, property.id, file),
              (name) => onPatch("delegationLetterFileNames", [name]),
              "تعذّر حفظ مرفق التفويض — حاول مرة أخرى",
            );
          }}
          onRemove={(name) => {
            onPatch(
              "delegationLetterFileNames",
              withoutFileName(property.delegationLetterFileNames, name),
            );
            if (attachPo) {
              void removeCachedPropertyDoc(
                "delegation",
                attachPo,
                property.id,
                name,
              );
            }
          }}
          onClear={() => onPatch("delegationLetterFileNames", [])}
        />
      ) : null}

      {showRegistryDoc ? (
        <PropertyFileUploadField
          id={`real_estate_reg_${property.id}`}
          label="السجل العقاري (مرفق) *"
          fileName={property.realEstateRegFileName}
          error={fieldErrors.realEstateRegFileName}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="registry"
          uploading={upload.isUploading("registry")}
          onUpload={(file) => {
            if (!attachPo) {
              onPatch("realEstateRegFileName", file.name);
              return;
            }
            void upload.run(
              "registry",
              file,
              () => cacheRegistryDoc(attachPo, property.id, file),
              (name) => onPatch("realEstateRegFileName", name),
              "تعذّر حفظ مرفق السجل العقاري — حاول مرة أخرى",
            );
          }}
          onClear={() => {
            onPatch("realEstateRegFileName", "");
            if (attachPo) {
              clearCachedPropertyDoc("registry", attachPo, property.id);
            }
          }}
        />
      ) : null}

      {showAssignmentDoc ? (
        <PropertyFileUploadField
          id={`assignment_doc_${property.id}`}
          label={<>قرار الإسناد *</>}
          fileNames={property.assignmentDocFileNames}
          error={fieldErrors.assignmentDocFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="decree"
          multiple
          maxFiles={1}
          uploading={upload.isUploading("decree")}
          onTooManyFiles={() =>
            showToast("ممنوع إدخال أكثر من مستند واحد", "error")
          }
          onUpload={(file) => {
            if (!attachPo) {
              onPatch("assignmentDocFileNames", [file.name]);
              return;
            }
            void upload.run(
              "decree",
              file,
              () => cacheAssignmentDoc(attachPo, property.id, file),
              (name) => onPatch("assignmentDocFileNames", [name]),
              "تعذّر حفظ مرفق قرار الإسناد — حاول مرة أخرى",
            );
          }}
          onRemove={(name) => {
            onPatch(
              "assignmentDocFileNames",
              withoutFileName(property.assignmentDocFileNames, name),
            );
            if (attachPo) {
              void removeCachedPropertyDoc("decree", attachPo, property.id, name);
            }
          }}
          onClear={() => onPatch("assignmentDocFileNames", [])}
        />
      ) : null}

      {showExtended ? (
        <PropertyFileUploadField
          id={`deed_ownership_${property.id}`}
          label="صورة وثيقة التملك (الصك) (اختياري)"
          fileName={property.deedOwnershipFileName}
          error={fieldErrors.deedOwnershipFileName}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="deed"
          uploading={upload.isUploading("deed")}
          onUpload={(file) => {
            if (!attachPo) {
              onPatch("deedOwnershipFileName", file.name);
              return;
            }
            void upload.run(
              "deed",
              file,
              () => cacheDeedOwnershipDoc(attachPo, property.id, file),
              (name) => onPatch("deedOwnershipFileName", name),
              "تعذّر حفظ صورة وثيقة التملك — حاول مرة أخرى",
            );
          }}
          onClear={() => {
            onPatch("deedOwnershipFileName", "");
            if (attachPo) {
              clearCachedPropertyDoc("deed", attachPo, property.id);
            }
          }}
        />
      ) : null}

      {showOtherDocs ? (
        <div className="col-span-full">
          <PoPropertyUnlistedDocumentField
            property={property}
            onPatch={onPatch}
            attachPo={attachPo}
          />
        </div>
      ) : null}
    </div>
  );
}
