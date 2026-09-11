"use client";

/**
 * Enfath form — property document uploads (delegation, registry, decree, deed
 * image, other). The attachment cache calls are the call sites of
 * `assignment-doc-attachments`; they are moved here verbatim.
 */

import { useToast } from "@platform/ui-kit";
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
} from "./po-property-enfath-form-state";

export function PoPropertyEnfathDocumentFields({
  property,
  fieldErrors,
  onPatch,
  attachPo,
  showDelegationDoc,
  showRegistryDoc,
  showExtended,
  showOtherDocs,
}: EnfathSectionProps & {
  attachPo: string;
  showDelegationDoc: boolean;
  showRegistryDoc: boolean;
  showExtended: boolean;
  showOtherDocs: boolean;
}) {
  const { showToast } = useToast();

  return (
    <>
      {showDelegationDoc ? (
        <PropertyFileUploadField
          id={`delegation_${property.id}`}
          label="خطاب التفويض *"
          fileNames={property.delegationLetterFileNames}
          error={fieldErrors.delegationLetterFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="delegation"
          multiple
          maxFiles={1}
          onTooManyFiles={() =>
            showToast("ممنوع إدخال أكثر من مستند واحد", "error")
          }
          onUpload={(file) => {
            onPatch("delegationLetterFileNames", [file.name]);
            if (attachPo) {
              void cacheDelegationDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast("تعذّر حفظ مرفق التفويض — حاول مرة أخرى", "error");
                });
            }
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
          onUpload={(file) => {
            onPatch("realEstateRegFileName", file.name);
            if (attachPo) {
              void cacheRegistryDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ مرفق السجل العقاري — حاول مرة أخرى",
                    "error",
                  );
                });
            }
          }}
          onClear={() => {
            onPatch("realEstateRegFileName", "");
            if (attachPo) {
              clearCachedPropertyDoc("registry", attachPo, property.id);
            }
          }}
        />
      ) : null}

      {showExtended ? (
        <PropertyFileUploadField
          id={`assignment_doc_${property.id}`}
          label={<>خطاب الإسناد *</>}
          fileNames={property.assignmentDocFileNames}
          error={fieldErrors.assignmentDocFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="decree"
          multiple
          maxFiles={1}
          onTooManyFiles={() =>
            showToast("ممنوع إدخال أكثر من مستند واحد", "error")
          }
          onUpload={(file) => {
            onPatch("assignmentDocFileNames", [file.name]);
            if (attachPo) {
              void cacheAssignmentDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ مرفق خطاب الإسناد — حاول مرة أخرى",
                    "error",
                  );
                });
            }
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
          onUpload={(file) => {
            onPatch("deedOwnershipFileName", file.name);
            if (attachPo) {
              void cacheDeedOwnershipDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ صورة وثيقة التملك — حاول مرة أخرى",
                    "error",
                  );
                });
            }
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
        <PoPropertyUnlistedDocumentField
          property={property}
          onPatch={onPatch}
          attachPo={attachPo}
        />
      ) : null}
    </>
  );
}
