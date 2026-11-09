"use client";

/**
 * What the inspector settles before «حفظ وإرسال», shared by the phone body
 * (`InspectorObservationsSection`) and the desktop wizard (`InspectorWorkspaceWizard`):
 * the key-envelope notes and the client declaration «تم توقيع إقرار العميل / صحة الموقع».
 */
import { Button, Note, useToast } from "@platform/ui-kit";
import { hasAnyPartyPhone } from "../../lib/app-data/documentary-workflow-gates";
import { inspectorKeyGateProblem } from "../../lib/app-data/inspector-key-gate";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { InspectorKeyAvailability } from "./InspectorKeyStatusTab";

/**
 * The key notes: «المفتاح غير مُسلَّم» (with «تسجيل تعذّر المفتاح») and, while the key status is
 * unknown, the reason the inspection cannot be sent yet (with «إعادة المحاولة»).
 *
 * How it works: the first note shows when the asset is not land and the key gate answered «no
 * key»; the second when `inspectorKeyGateProblem` names a problem (failed load, offline, no
 * session) — offline offers no retry because the gate reloads itself when the connection is back.
 *
 * Edge cases: lifted out of the phone's observations card 2026-11-04 so the desktop shows the
 * same notes — it showed neither, while its submit now waits for the same key answer.
 */
export function InspectorKeyStatusNotes({
  keyAvailability,
  isLand,
  onRegisterFailure,
}: {
  keyAvailability: Pick<InspectorKeyAvailability, "keyAvailable" | "status" | "retry">;
  isLand: boolean;
  onRegisterFailure?: () => void;
}) {
  const keyGateProblem = inspectorKeyGateProblem(keyAvailability.status);
  return (
    <>
      {!isLand && keyAvailability.keyAvailable === false ? (
        <Note tone="info" className="mt-3">
          المفتاح غير مُسلَّم بعد (معلومة من ظرف المفاتيح) — يمكنك إتمام
          المعاينة. إن كان الدخول متعذّراً بسبب المفتاح سجّل تعذّراً.
          {onRegisterFailure ? (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRegisterFailure}
              >
                تسجيل تعذّر المفتاح
              </Button>
            </div>
          ) : null}
        </Note>
      ) : null}
      {keyGateProblem ? (
        <Note tone="danger" className="mt-3">
          {keyGateProblem} لا تُرسَل المعاينة قبل معرفتها.
          {keyAvailability.status === "offline" ? null : (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                showActionToast={false}
                onClick={keyAvailability.retry}
              >
                إعادة المحاولة
              </Button>
            </div>
          )}
        </Note>
      ) : null}
    </>
  );
}

/**
 * «تم توقيع إقرار العميل / صحة الموقع» checkbox.
 *
 * How it works: ticking it needs a party mobile number — without one (and without a number
 * recorded at an earlier signing) it refuses with a toast; a tick with a number present also
 * records `declarationPhoneSatisfied`, so removing the number later does not undo the signing.
 *
 * Edge cases: lifted out of the phone's observations card 2026-11-04 — the desktop had no
 * declaration at all, so a desktop submit always sent it unsigned.
 */
export function InspectorClientDeclarationField({
  draft,
  contacts,
  disabled = false,
  onPatch,
}: {
  draft: Pick<InspectorWorkspaceDraft, "clientDeclarationSigned" | "declarationPhoneSatisfied">;
  contacts: ReadonlyArray<{ phone?: string }> | null | undefined;
  disabled?: boolean;
  onPatch: (
    patch: Pick<InspectorWorkspaceDraft, "clientDeclarationSigned" | "declarationPhoneSatisfied">,
  ) => void;
}) {
  const { showToast } = useToast();
  return (
    <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-2">
      <input
        type="checkbox"
        className="mt-0.5"
        id="ins-client-declaration"
        checked={draft.clientDeclarationSigned}
        disabled={disabled}
        onChange={(e) => {
          const signed = e.target.checked;
          const hasPhone = hasAnyPartyPhone(contacts);
          if (signed && !hasPhone && !draft.declarationPhoneSatisfied) {
            showToast("لا يمكن توقيع إقرار العميل بدون جوال لأحد الأطراف.", "error");
            return;
          }
          onPatch({
            clientDeclarationSigned: signed,
            declarationPhoneSatisfied: draft.declarationPhoneSatisfied || (signed && hasPhone),
          });
        }}
      />
      <span>
        تم توقيع إقرار العميل / صحة الموقع (يتطلب جوال أحد الأطراف عند
        أول توقيع)
      </span>
    </label>
  );
}
