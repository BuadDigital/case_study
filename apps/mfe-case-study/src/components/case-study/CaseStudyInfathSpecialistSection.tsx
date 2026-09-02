"use client";

import {
  FormGroup,
  Input,
  Label,
  Textarea,
  cn,
} from "@platform/ui-kit";
import type { CaseStudyFormDraft } from "../../lib/app-data/case-study-form-storage";
import {
  INFATH_FIELD_LABELS,
  INFATH_YES_NO_OPTIONS,
} from "../../lib/app-data/infath-field-labels";

export function CaseStudyInfathSpecialistSection({
  draft,
  disabled,
  onPatch,
}: {
  draft: CaseStudyFormDraft;
  disabled?: boolean;
  onPatch: (patch: Partial<CaseStudyFormDraft>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border">
      <header className="border-b border-border bg-surface-2 px-4 py-2.5">
        <h3 className="m-0 text-[12.5px] font-bold text-heading">
          بيانات الرفع لإنفاذ
        </h3>
      </header>

      <div className="grid gap-3.5 px-4 py-3.5 sm:grid-cols-2">
        <FormGroup className="sm:col-span-2">
          <Label className="mb-2 text-[11px] font-semibold text-text-2">
            {INFATH_FIELD_LABELS.linkedAssets}
          </Label>
          <div className="flex flex-wrap gap-2">
            {INFATH_YES_NO_OPTIONS.map((opt) => {
              const on = draft.infathLinkedAssets === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors",
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-border-md bg-surface text-text-2 hover:text-heading",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name="infath-linked"
                    className="sr-only"
                    checked={on}
                    disabled={disabled}
                    onChange={() => onPatch({ infathLinkedAssets: opt.value })}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </FormGroup>

        {draft.infathLinkedAssets === "yes" ? (
          <FormGroup className="sm:col-span-2">
            <Label htmlFor="infath-linked-deeds" className="text-[11px] text-text-2">
              {INFATH_FIELD_LABELS.linkedDeedNumbers}
            </Label>
            <Input
              id="infath-linked-deeds"
              disabled={disabled}
              value={draft.infathLinkedDeedNumbers ?? ""}
              onChange={(e) =>
                onPatch({ infathLinkedDeedNumbers: e.target.value })
              }
            />
          </FormGroup>
        ) : null}

        <FormGroup>
          <Label htmlFor="infath-linked-notes" className="text-[11px] text-text-2">
            {INFATH_FIELD_LABELS.linkedAssetsNotes}
          </Label>
          <Textarea
            id="infath-linked-notes"
            rows={2}
            disabled={disabled}
            value={draft.infathLinkedAssetsNotes ?? ""}
            onChange={(e) =>
              onPatch({ infathLinkedAssetsNotes: e.target.value })
            }
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="infath-other-notes" className="text-[11px] text-text-2">
            {INFATH_FIELD_LABELS.otherNotes}
          </Label>
          <Textarea
            id="infath-other-notes"
            rows={2}
            disabled={disabled}
            value={draft.infathOtherNotes ?? ""}
            onChange={(e) => onPatch({ infathOtherNotes: e.target.value })}
          />
        </FormGroup>

        <FormGroup className="sm:col-span-2">
          <Label htmlFor="infath-closing-notes" className="text-[11px] text-text-2">
            {INFATH_FIELD_LABELS.closingNotes}
          </Label>
          <Textarea
            id="infath-closing-notes"
            rows={2}
            disabled={disabled}
            value={draft.infathClosingNotes ?? ""}
            onChange={(e) => onPatch({ infathClosingNotes: e.target.value })}
          />
        </FormGroup>
      </div>
    </section>
  );
}
