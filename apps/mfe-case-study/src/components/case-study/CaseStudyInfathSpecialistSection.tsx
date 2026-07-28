"use client";
import { Card, CardBody, FormGroup, Input, Label, Textarea } from "@platform/design-system";
import type { CaseStudyFormDraft } from "../../lib/prototype/case-study-form-storage";
import { INFATH_FIELD_LABELS, INFATH_YES_NO_OPTIONS } from "../../lib/prototype/infath-field-labels";

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
    <Card className="mt-4">
      <CardBody>
        <h3 className="mb-4 text-sm font-semibold text-text">
          بيانات الرفع لإنفاذ (أخصائي)
        </h3>
        <FormGroup className="mb-4">
          <Label className="mb-2 text-xs">{INFATH_FIELD_LABELS.linkedAssets}</Label>
          <div className="flex flex-wrap gap-4">
            {INFATH_YES_NO_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-text-2"
              >
                <input
                  type="radio"
                  name="infath-linked"
                  checked={draft.infathLinkedAssets === opt.value}
                  disabled={disabled}
                  onChange={() => onPatch({ infathLinkedAssets: opt.value })}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </FormGroup>
        {draft.infathLinkedAssets === "yes" ? (
          <FormGroup className="mb-4">
            <Label htmlFor="infath-linked-deeds" className="text-xs">
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
        <FormGroup className="mb-4">
          <Label htmlFor="infath-linked-notes" className="text-xs">
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
        <FormGroup className="mb-4">
          <Label htmlFor="infath-other-notes" className="text-xs">
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
        <FormGroup>
          <Label htmlFor="infath-closing-notes" className="text-xs">
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
      </CardBody>
    </Card>
  );
}
