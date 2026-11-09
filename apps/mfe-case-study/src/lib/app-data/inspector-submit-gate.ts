/**
 * The inspector's own checks before «حفظ وإرسال» that are not field validation — one set for the
 * phone (`useFieldInspectionWorkflow`) and the desktop wizard (`submitPropertyDetailInspection`).
 */
import type { RoleId } from "@platform/types";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { declarationPhoneGate, hasAnyPartyPhone } from "./documentary-workflow-gates";
import { inspectorKeySubmitGate, type InspectorKeyGateStatus } from "./inspector-key-gate";

type InspectorPreSubmitGate =
  | { ok: true; keyAvailable: boolean; hasPhone: boolean }
  | { ok: false; reason: string };

/**
 * May the inspector send now, as far as the client declaration and the key status go?
 *
 * How it works: (1) a signed client declaration needs a party mobile number (or one recorded at the
 * signing) unless the role bypasses the documentary gates (`declarationPhoneGate`); (2) the key
 * status must be known (`inspectorKeySubmitGate`) — it is sent with the inspection. Returns the
 * known key answer and whether a party phone exists, both used by `inspectorSubmitStamp`.
 *
 * Edge cases: added 2026-11-04 for the desktop, whose submit sent neither the key status nor the
 * declaration and never waited for the key answer; the phone's two inline checks moved here.
 */
export function inspectorPreSubmitGate(input: {
  draft: Pick<InspectorWorkspaceDraft, "clientDeclarationSigned" | "declarationPhoneSatisfied">;
  role: RoleId;
  contacts: ReadonlyArray<{ phone?: string }> | null | undefined;
  keyAvailability: { status: InspectorKeyGateStatus; keyAvailable: boolean | null };
}): InspectorPreSubmitGate {
  const hasPhone = hasAnyPartyPhone(input.contacts);
  const phoneGate = declarationPhoneGate({
    role: input.role,
    hasPhone,
    phoneWasPresentAtDeclaration: input.draft.declarationPhoneSatisfied,
  });
  if (input.draft.clientDeclarationSigned && !phoneGate.ready) {
    return { ok: false, reason: phoneGate.reason };
  }
  const keyGate = inspectorKeySubmitGate(input.keyAvailability);
  if (!keyGate.ok) return { ok: false, reason: keyGate.reason };
  return { ok: true, keyAvailable: keyGate.keyAvailable, hasPhone };
}

/**
 * The fields stamped on the inspection as it is sent: the key status, the declaration and whether
 * a party phone was present when it was signed.
 *
 * How it works: copies `vacantLand` and `clientDeclarationSigned`, takes `keyAvailable` from the
 * passed gate, and keeps `declarationPhoneSatisfied` once true (a signing with a phone sets it).
 *
 * Edge cases: shared by the phone's `sendInspectorSubmission` and the desktop submit (2026-11-04);
 * the desktop used to leave `keyAvailable` at its draft default (false).
 */
export function inspectorSubmitStamp(
  draft: Pick<
    InspectorWorkspaceDraft,
    "vacantLand" | "clientDeclarationSigned" | "declarationPhoneSatisfied"
  >,
  gate: { keyAvailable: boolean; hasPhone: boolean },
): Pick<
  InspectorWorkspaceDraft,
  "vacantLand" | "keyAvailable" | "clientDeclarationSigned" | "declarationPhoneSatisfied"
> {
  return {
    vacantLand: draft.vacantLand,
    keyAvailable: gate.keyAvailable,
    clientDeclarationSigned: draft.clientDeclarationSigned,
    declarationPhoneSatisfied:
      draft.declarationPhoneSatisfied || (draft.clientDeclarationSigned && gate.hasPhone),
  };
}
