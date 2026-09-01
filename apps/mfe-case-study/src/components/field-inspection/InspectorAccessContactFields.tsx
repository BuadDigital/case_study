"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@platform/ui-kit";
import {
  contactRoleSelectOptions,
  type PoContact,
} from "../../lib/prototype/po-intake-data";
import { isValidContactEntry } from "../../lib/domain/po-intake/property-validation";
import {
  ACCESS_CONTACT_ADD_BUTTON_LABEL,
  ACCESS_CONTACT_NAME_LABEL,
  ACCESS_CONTACT_NEW_BUTTON_LABEL,
  ACCESS_CONTACT_PHONE_LABEL,
  ACCESS_CONTACT_ROLE_LABEL,
  ACCESS_ROUTE_DESCRIPTION_HINT,
  ACCESS_ROUTE_DESCRIPTION_LABEL,
  patchAccessContact,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import type { InspectorWorkspaceFieldErrors } from "../../lib/prototype/inspector-workspace-validation";
import {
  EDIT_CONTROL_CLASS,
  INS_LABEL_CLASS,
  INS_WIZARD_PIN_BUTTON_CLASS,
} from "./FieldInspectionWorkParts";
import { InspectorSiteLocationAckButton } from "./InspectorSiteLocationAckButton";

const NEW_CONTACT_VALUE = "__new__";

function contactOptionLabel(c: PoContact, index: number): string {
  const name = c.name.trim() || `جهة ${index + 1}`;
  const role = c.role.trim();
  const phone = c.phone.trim();
  return [name, role, phone].filter(Boolean).join(" — ");
}

function contactsMatch(
  a: { name: string; phone: string; role: string },
  b: PoContact,
): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.phone.trim() === b.phone.trim() &&
    a.role.trim() === b.role.trim()
  );
}

function draftContact(draft: InspectorWorkspaceDraft): PoContact {
  return {
    name: draft.accessContactName.trim(),
    phone: draft.accessContactPhone.trim(),
    role: draft.accessContactRole.trim(),
  };
}

export function InspectorAccessContactFields({
  draft,
  contacts = [],
  editable,
  fieldErrors = {},
  onPatch,
  onAckClick,
  layout = "desktop",
}: {
  draft: InspectorWorkspaceDraft;
  /** Property / transaction contacts (بيانات الاتصال). */
  contacts?: readonly PoContact[];
  editable: boolean;
  fieldErrors?: InspectorWorkspaceFieldErrors;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
  onAckClick: () => void;
  layout?: "desktop" | "mobile";
}) {
  const [addedContacts, setAddedContacts] = useState<PoContact[]>([]);
  const didPrefill = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const validContacts = useMemo(() => {
    const merged = [...contacts, ...addedContacts];
    const seen = new Set<string>();
    const out: PoContact[] = [];
    for (const c of merged) {
      if (!isValidContactEntry(c)) continue;
      const key = `${c.name.trim()}|${c.phone.trim()}|${c.role.trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [contacts, addedContacts]);

  function patchContact(
    patch: Partial<{
      accessContactName: string;
      accessContactPhone: string;
      accessContactRole: string;
    }>,
  ) {
    onPatch(patchAccessContact(draft, patch));
  }

  // Prefill from transaction contact when access fields are still empty.
  useEffect(() => {
    if (!editable || didPrefill.current) return;
    const hasAny =
      draft.accessContactName.trim() ||
      draft.accessContactPhone.trim() ||
      draft.accessContactRole.trim();
    if (hasAny) {
      didPrefill.current = true;
      return;
    }
    const first = validContacts[0];
    if (!first) return;
    didPrefill.current = true;
    onPatch(
      patchAccessContact(draft, {
        accessContactName: first.name,
        accessContactPhone: first.phone,
        accessContactRole: first.role,
      }),
    );
  }, [
    editable,
    validContacts,
    draft.accessContactName,
    draft.accessContactPhone,
    draft.accessContactRole,
    draft,
    onPatch,
  ]);

  const selectedValue = useMemo(() => {
    const idx = validContacts.findIndex((c) =>
      contactsMatch(
        {
          name: draft.accessContactName,
          phone: draft.accessContactPhone,
          role: draft.accessContactRole,
        },
        c,
      ),
    );
    return idx >= 0 ? String(idx) : NEW_CONTACT_VALUE;
  }, [
    validContacts,
    draft.accessContactName,
    draft.accessContactPhone,
    draft.accessContactRole,
  ]);

  const canAddToContacts = useMemo(() => {
    if (!editable) return false;
    const next = draftContact(draft);
    if (!next.name || !isValidContactEntry(next)) return false;
    return !validContacts.some((c) => contactsMatch(next, c));
  }, [
    editable,
    draft.accessContactName,
    draft.accessContactPhone,
    draft.accessContactRole,
    validContacts,
  ]);

  function selectContact(value: string) {
    if (!editable) return;
    if (value === NEW_CONTACT_VALUE) {
      startNewContact();
      return;
    }
    const contact = validContacts[Number(value)];
    if (!contact) return;
    patchContact({
      accessContactName: contact.name,
      accessContactPhone: contact.phone,
      accessContactRole: contact.role,
    });
  }

  function startNewContact() {
    if (!editable) return;
    patchContact({
      accessContactName: "",
      accessContactPhone: "",
      accessContactRole: "",
    });
    queueMicrotask(() => nameInputRef.current?.focus());
  }

  function addCurrentToContacts() {
    if (!canAddToContacts) return;
    const next = draftContact(draft);
    setAddedContacts((prev) => [...prev, next]);
  }

  const roleOptions = useMemo(
    () => contactRoleSelectOptions(draft.accessContactRole),
    [draft.accessContactRole],
  );

  const controlClass = (invalid?: boolean) =>
    cn(
      EDIT_CONTROL_CLASS,
      layout === "desktop" && "h-[38px]",
      layout === "mobile" && "h-12",
      invalid && "border-danger",
      !editable && "cursor-default opacity-90",
    );

  const actionBtnClass = cn(
    INS_WIZARD_PIN_BUTTON_CLASS,
    "shrink-0",
    layout === "mobile" &&
      "h-12 min-h-12 rounded-xl border-[1.5px] px-4 text-[14px]",
  );

  return (
    <div className="mt-3">
      <span
        className={cn(
          INS_LABEL_CLASS,
          (fieldErrors.accessContactName ||
            fieldErrors.accessContactPhone ||
            fieldErrors.accessContactRole) &&
            "text-danger",
        )}
      >
        {ACCESS_ROUTE_DESCRIPTION_LABEL}
      </span>
      <p id="ins-access-hint" className="mb-1.5 text-[11px] text-text-3">
        {ACCESS_ROUTE_DESCRIPTION_HINT}
      </p>

      <div className="mb-2.5">
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-0 flex-1">
            <select
              id="ins-access-contact-pick"
              disabled={!editable}
              aria-label="جهة الاتصال من المعاملة"
              className={controlClass()}
              value={selectedValue}
              onChange={(e) => selectContact(e.target.value)}
            >
              {validContacts.length === 0 ? (
                <option value={NEW_CONTACT_VALUE}>لا توجد جهات اتصال بعد</option>
              ) : null}
              {validContacts.map((c, i) => (
                <option key={`${c.phone}-${i}`} value={String(i)}>
                  {contactOptionLabel(c, i)}
                </option>
              ))}
              {selectedValue === NEW_CONTACT_VALUE && validContacts.length > 0 ? (
                <option value={NEW_CONTACT_VALUE}>جهة اتصال جديدة (غير محفوظة)</option>
              ) : null}
            </select>
          </div>
          {editable ? (
            <button
              type="button"
              id="ins-access-contact-new"
              className={actionBtnClass}
              onClick={startNewContact}
            >
              {ACCESS_CONTACT_NEW_BUTTON_LABEL}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="min-w-0">
            <label htmlFor="ins-access-name" className={INS_LABEL_CLASS}>
              {ACCESS_CONTACT_NAME_LABEL}
            </label>
            <input
              ref={nameInputRef}
              id="ins-access-name"
              type="text"
              disabled={!editable}
              aria-invalid={Boolean(fieldErrors.accessContactName) || undefined}
              className={controlClass(Boolean(fieldErrors.accessContactName))}
              value={draft.accessContactName}
              onChange={(e) =>
                patchContact({ accessContactName: e.target.value })
              }
            />
            {fieldErrors.accessContactName ? (
              <p className="mt-1 mb-0 text-[11px] text-danger-text">
                {fieldErrors.accessContactName}
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label htmlFor="ins-access-phone" className={INS_LABEL_CLASS}>
              {ACCESS_CONTACT_PHONE_LABEL}
            </label>
            <input
              id="ins-access-phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              disabled={!editable}
              aria-invalid={Boolean(fieldErrors.accessContactPhone) || undefined}
              className={controlClass(Boolean(fieldErrors.accessContactPhone))}
              value={draft.accessContactPhone}
              onChange={(e) =>
                patchContact({ accessContactPhone: e.target.value })
              }
            />
            {fieldErrors.accessContactPhone ? (
              <p className="mt-1 mb-0 text-[11px] text-danger-text">
                {fieldErrors.accessContactPhone}
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label htmlFor="ins-access-role" className={INS_LABEL_CLASS}>
              {ACCESS_CONTACT_ROLE_LABEL}
            </label>
            <select
              id="ins-access-role"
              disabled={!editable}
              aria-invalid={Boolean(fieldErrors.accessContactRole) || undefined}
              className={controlClass(Boolean(fieldErrors.accessContactRole))}
              value={draft.accessContactRole}
              onChange={(e) =>
                patchContact({ accessContactRole: e.target.value })
              }
            >
              <option value="">— اختر —</option>
              {roleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {fieldErrors.accessContactRole ? (
              <p className="mt-1 mb-0 text-[11px] text-danger-text">
                {fieldErrors.accessContactRole}
              </p>
            ) : null}
          </div>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-end gap-2">
            {canAddToContacts ? (
              <button
                type="button"
                id="ins-access-contact-add"
                className={actionBtnClass}
                onClick={addCurrentToContacts}
              >
                {ACCESS_CONTACT_ADD_BUTTON_LABEL}
              </button>
            ) : null}
            <InspectorSiteLocationAckButton
              className={
                layout === "mobile"
                  ? "h-12 min-h-12 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] px-4 text-[14px] text-ink"
                  : undefined
              }
              onClick={onAckClick}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
