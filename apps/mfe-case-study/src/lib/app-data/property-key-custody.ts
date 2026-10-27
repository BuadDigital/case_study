/**
 * Key custody as the property page reads it: the envelope has
 * one holder, and each deed's matching key has a place after the field trial.
 * «تسليم للمعاين» compares the holder, or the key's holder, with this deed's
 * inspector — the operations context cannot see case-study tasks, so the
 * comparison happens here. No React, no I/O.
 */
import {
  KeyHolderKinds,
  KeyLocations,
  PropertyKeyHandedValues,
  PropertyKeysStatuses,
  type PropertyKeyGateDto,
} from "@platform/api-client";

type GateCustody = Pick<
  PropertyKeyGateDto,
  | "keyHandedToInspector"
  | "envelopeHolderKind"
  | "envelopeHolderUserId"
  | "envelopeHolderLabel"
  | "keyLocation"
  | "keyHolderUserId"
  | "keyHolderLabel"
>;

/** Arabic label for the envelope's single holder: reviewer, internal user, external party or court. */
export function envelopeHolderLabelAr(
  kind: string | null | undefined,
  label: string | null | undefined,
): string {
  const name = label?.trim();
  switch (kind) {
    case KeyHolderKinds.InternalUser:
      return name || "مستخدم داخلي";
    case KeyHolderKinds.External:
      return name ? `طرف خارجي: ${name}` : "طرف خارجي";
    case KeyHolderKinds.Court:
      return name || "المحكمة";
    case KeyHolderKinds.Reviewer:
      return name || "المراجع الحكومي";
    default:
      return "—";
  }
}

/** Arabic label for where this deed's key is after the field trial (envelope, a user, court, missing). */
export function keyLocationLabelAr(
  location: string | null | undefined,
  holderLabel: string | null | undefined,
): string {
  const name = holderLabel?.trim();
  switch (location) {
    case KeyLocations.WithUser:
      return name ? `عند ${name}` : "عند مستخدم";
    case KeyLocations.ReturnedCourt:
      return "أُعيد للمحكمة";
    case KeyLocations.Missing:
      return "مفقود";
    case KeyLocations.InEnvelope:
      return "في الظرف";
    default:
      return "—";
  }
}

/** Fallback to the older yes/no «handed» value when no holder or key place says otherwise. */
function legacyHandedLabel(value: string): string {
  if (value === PropertyKeyHandedValues.Yes) return "تم التسليم";
  if (value === PropertyKeyHandedValues.No) return "لم يُسلَّم";
  if (value === PropertyKeysStatuses.NotRequired) return "غير مطلوب";
  return value?.trim() || "لم تُحدَّد بعد";
}

/**
 * «تسليم للمعاين» for one deed: yes when this deed's inspector holds the
 * envelope or its key; otherwise where the envelope or key actually is.
 *
 * How it works, first match wins: 1) no gate → the legacy «لم تُحدَّد بعد»; 2) the envelope holder
 * is an internal user with this inspector's id, or the key is `with_user` with this inspector's id
 * → handed, «نعم — عند <name>» (the inspector's name, else the holder's label); 3) the envelope is
 * with another internal user → «الظرف عند <name> (معاين صك آخر)» («… عند <name>» when the deed has
 * no inspector); 4) the key is with another user → «المفتاح عند <name>»; 5) else the legacy yes/no.
 *
 * Edge cases: decided here because the operations service cannot see case-study tasks; one
 * envelope can serve several deeds, so a deed whose envelope sits with another deed's inspector
 * never reads «تم التسليم» even when the old flag says yes.
 */
export function keyHandedToInspectorText(
  gate: GateCustody | null | undefined,
  inspector: { id?: string | null; name?: string | null } | null | undefined,
): { handed: boolean; text: string } {
  if (!gate) return { handed: false, text: legacyHandedLabel("") };
  const inspectorId = inspector?.id?.trim() || null;
  const holderIsInspector =
    gate.envelopeHolderKind === KeyHolderKinds.InternalUser &&
    Boolean(inspectorId) &&
    gate.envelopeHolderUserId === inspectorId;
  const keyWithInspector =
    gate.keyLocation === KeyLocations.WithUser &&
    Boolean(inspectorId) &&
    gate.keyHolderUserId === inspectorId;
  if (holderIsInspector || keyWithInspector) {
    const name =
      inspector?.name?.trim() ||
      (holderIsInspector ? gate.envelopeHolderLabel : gate.keyHolderLabel)?.trim();
    return { handed: true, text: name ? `نعم — عند ${name}` : "نعم" };
  }
  if (gate.envelopeHolderKind === KeyHolderKinds.InternalUser) {
    const name = gate.envelopeHolderLabel?.trim() || "مستخدم آخر";
    return {
      handed: false,
      text: inspectorId ? `الظرف عند ${name} (معاين صك آخر)` : `الظرف عند ${name}`,
    };
  }
  if (gate.keyLocation === KeyLocations.WithUser) {
    return {
      handed: false,
      text: `المفتاح عند ${gate.keyHolderLabel?.trim() || "مستخدم آخر"}`,
    };
  }
  return { handed: false, text: legacyHandedLabel(gate.keyHandedToInspector) };
}
