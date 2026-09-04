"use client";

/**
 * Wizard step 3 card of `InspectorWorkspaceWizard` - documented field
 * observations (category, note, stamped photo) with add/remove.
 */

import { Button, cn, Select } from "@platform/ui-kit";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  INSPECTOR_OBSERVATION_CATEGORIES,
  inspectorPhotoStampText,
  newObservationId,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  inspectorPhotoAttachmentFromTransactionDoc,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import {
  InsCard,
  EDIT_CONTROL_CLASS,
} from "../po-intake/PropertyDetailInspectionParts";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";

export function InspectorFieldObservationsCard({
  deedNumber,
  draft,
  editable,
  serviceProofFromTransactionPhotos,
  transactionPhotos,
  onPatch,
}: {
  deedNumber: string;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  serviceProofFromTransactionPhotos: boolean;
  transactionPhotos: PropertyDetailDocumentEntry[];
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const photoStamp = inspectorPhotoStampText(draft);

  return (
    <>
      <InsCard
        title="الملاحظات الميدانية"
        badge={
          <DetailBadge tone="gray">شرح + صورة لكل ملاحظة</DetailBadge>
        }
      >
        {draft.observations.length === 0 ? (
          <p className="m-0 mt-2 text-[11.5px] text-text-3">
            لا توجد ملاحظات ميدانية مسجّلة.
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-2">
          {draft.observations.map((obs, index) => {
            const obsPhotoRef = `observation:${obs.id}`;
            return (
            <div
              key={obs.id}
              className="grid grid-cols-[150px_minmax(0,1fr)_auto_auto] items-stretch gap-2 rounded-lg border border-border bg-surface-2 p-2.5"
            >
              <Select
                value={obs.category}
                disabled={!editable}
                className="h-full min-h-9"
                onChange={(e) => {
                  const next = [...draft.observations];
                  next[index] = { ...obs, category: e.target.value };
                  onPatch({ observations: next });
                }}
              >
                {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <input
                className={cn(EDIT_CONTROL_CLASS, "h-full min-h-9")}
                placeholder="اشرح الملاحظة…"
                value={obs.text}
                disabled={!editable}
                onChange={(e) => {
                  const next = [...draft.observations];
                  next[index] = { ...obs, text: e.target.value };
                  onPatch({ observations: next });
                }}
              />
              <div className="flex min-w-[96px] self-stretch">
                {obs.photo?.fileName ? (
                  <InspectorStampedPhotoThumb
                    stamp={photoStamp}
                    compact
                    taskId={draft.taskId}
                    photoRef={obsPhotoRef}
                    attachment={obs.photo}
                    onClear={
                      editable
                        ? () => {
                            clearInspectorPhotoDataUrl(
                              draft.taskId,
                              obsPhotoRef,
                            );
                            const next = [...draft.observations];
                            next[index] = { ...obs, photo: null };
                            onPatch({ observations: next });
                          }
                        : undefined
                    }
                  />
                ) : editable ? (
                  <InspectorPhotoFilePicker
                    label="إرفاق صورة"
                    compact
                    disabled={!editable}
                    className="h-full"
                    transactionPhotos={
                      serviceProofFromTransactionPhotos
                        ? transactionPhotos
                        : undefined
                    }
                    onTransactionPhotoSelected={
                      serviceProofFromTransactionPhotos
                        ? (doc) => {
                            const next = [...draft.observations];
                            next[index] = {
                              ...obs,
                              photo: inspectorPhotoAttachmentFromTransactionDoc(
                                draft.taskId,
                                obsPhotoRef,
                                doc,
                              ),
                            };
                            onPatch({ observations: next });
                            return true;
                          }
                        : undefined
                    }
                    onFilesSelected={async (files) => {
                      const file = files[0];
                      if (!file) return false;
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        obsPhotoRef,
                        file,
                        {
                          draft,
                          deedNumber: deedNumber,
                        },
                      );
                      if (!result.ok) {
                        throw new Error(result.error);
                      }
                      const next = [...draft.observations];
                      next[index] = { ...obs, photo: result.attachment };
                      onPatch({ observations: next });
                      return true;
                    }}
                  />
                ) : (
                  <span className="text-[11px] text-text-3">بدون صورة</span>
                )}
              </div>
              {editable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="self-center"
                  onClick={() =>
                    onPatch({
                      observations: draft.observations.filter(
                        (o) => o.id !== obs.id,
                      ),
                    })
                  }
                >
                  حذف
                </Button>
              ) : null}
            </div>
            );
          })}
        </div>
        {editable ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="mt-2.5"
            onClick={() =>
              onPatch({
                observations: [
                  ...draft.observations,
                  {
                    id: newObservationId(),
                    category: INSPECTOR_OBSERVATION_CATEGORIES[0],
                    text: "",
                    photo: null,
                  },
                ],
              })
            }
          >
            إضافة ملاحظة موثّقة
          </Button>
        ) : null}
      </InsCard>
    </>
  );
}
