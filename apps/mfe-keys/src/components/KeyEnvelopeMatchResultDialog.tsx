"use client";

/**
 * Field match result for one deed — the tile picker plus the note that is
 * mandatory for anything but a full match, and, for a match, where the
 * matching key went afterwards (decision 2026-10-20). Validation lives in
 * `key-envelope-dialogs-state`; the parent persists the chosen status.
 */
import { useState } from "react";
import { Button, Input, Label, cn } from "@platform/ui-kit";
import type {
  KeyAssignmentMatchStatus,
  KeyLocation,
} from "../lib/keys-envelope-types";
import { KEY_PLACE_TILES, MATCH_RESULT_TILES } from "./key-envelope-detail-state";
import {
  matchResultHasKeyToPlace,
  validateMatchResult,
} from "./key-envelope-dialogs-state";
import { DialogErrorBanner, SaveCheckIcon } from "./KeyEnvelopeDialogShared";

function TileButton({
  on,
  color,
  label,
  hint,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-[52px] items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 text-start font-[inherit] transition-all duration-100",
        on ? "border-[var(--gold)] bg-[var(--gold-soft)]" : "border-border-md bg-surface-2",
      )}
      onClick={onClick}
    >
      <span
        className="size-3.5 shrink-0 rounded-full border-2"
        style={{ borderColor: color, background: on ? color : "transparent" }}
      />
      <span>
        <span className="block text-[13.5px] font-extrabold" style={{ color }}>
          {label}
        </span>
        <span className="mt-px block text-[11.5px] text-text-3">{hint}</span>
      </span>
    </button>
  );
}

/**
 * The «نتيجة المطابقة» dialog for one deed's key trial.
 *
 * How it works: the user picks a result tile (`MATCH_RESULT_TILES`); for a match or partial
 * match (`matchResultHasKeyToPlace`) a second tile row asks where the matching key is now
 * (`KEY_PLACE_TILES`: back in the envelope / kept with me); a note field appears for anything
 * but a full match. Save runs `validateMatchResult` and passes status, note and key place to
 * `onSave`, or shows the validation error.
 *
 * Edge cases: decision 2026-10-20 — no place tile clicked reads as «back in the envelope» (that
 * tile shows selected and that is what is saved); a result with no key to place sends null.
 */
export function MatchResultModal({
  deed,
  busy,
  onClose,
  onSave,
}: {
  deed: string;
  busy: boolean;
  onClose: () => void;
  onSave: (
    status: KeyAssignmentMatchStatus,
    note?: string,
    keyLocation?: KeyLocation | null,
  ) => void;
}) {
  const [sel, setSel] = useState<KeyAssignmentMatchStatus | "">("");
  const [keyPlace, setKeyPlace] = useState<KeyLocation | "">("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-2)] flex items-start justify-center overflow-y-auto bg-[rgba(16,43,78,0.42)] px-4 py-[6vh] backdrop-blur-[2px] max-lg:items-stretch max-lg:px-0 max-lg:py-0"
      role="presentation"
      onClick={onClose}
    >
      <style>{`@keyframes keyModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kr-match-title"
        className="w-full max-w-[520px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)] [animation:keyModalIn_0.22s_ease_both] max-lg:min-h-dvh max-lg:max-w-none max-lg:rounded-none max-lg:border-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-border px-[22px] py-4">
          <h2
            id="kr-match-title"
            className="m-0 text-center text-[16px] font-extrabold text-heading"
          >
            تسجيل نتيجة المطابقة
          </h2>
          <button
            type="button"
            className="absolute start-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] leading-none text-text-2 transition-[background,color] duration-150 hover:bg-row-hover hover:text-heading"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-[22px] py-5">
          <DialogErrorBanner error={err} />
          <div className="rounded-[10px] border border-border bg-surface-2/40 px-3.5 py-2.5 text-[12.5px] text-text-2">
            نتيجة المطابقة الميدانية للصك{" "}
            <b className="text-heading">{deed}</b>.
          </div>
          <div>
            <Label>نتيجة تجربة المفاتيح ميدانياً *</Label>
            <div className="mt-1.5 grid gap-2">
              {MATCH_RESULT_TILES.map((t) => (
                <TileButton
                  key={t.id}
                  on={sel === t.id}
                  color={t.color}
                  label={t.label}
                  hint={t.hint}
                  onClick={() => {
                    setSel(t.id);
                    setErr("");
                  }}
                />
              ))}
            </div>
          </div>
          {/* Decision 2026-10-20: a deed whose key matched records where that key is now;
              nothing picked means it stays in the envelope. */}
          {matchResultHasKeyToPlace(sel) ? (
            <div>
              <Label>أين المفتاح المطابق الآن؟</Label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {KEY_PLACE_TILES.map((t) => (
                  <TileButton
                    key={t.id}
                    on={(keyPlace || "in_envelope") === t.id}
                    color={t.color}
                    label={t.label}
                    hint={t.hint}
                    onClick={() => setKeyPlace(t.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {sel && sel !== "matched" ? (
            <div>
              <Label htmlFor="kr-note">ملاحظة *</Label>
              <Input
                id="kr-note"
                value={note}
                placeholder="مثال: عمارة 6 شقق — 5 مفاتيح مطابقة، شقة رقم 3 بدون مفتاح"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-start gap-2 border-t border-border px-[22px] py-3.5 max-lg:sticky max-lg:bottom-0 max-lg:bg-surface max-lg:pb-[max(0.875rem,env(safe-area-inset-bottom))] max-lg:[&>button]:min-h-11 max-lg:[&>button]:flex-1">
          <Button
            variant="outline"
            disabled={busy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={() => {
              const result = validateMatchResult(sel, note, keyPlace);
              if (!result.ok) {
                setErr(result.error);
                return;
              }
              onSave(result.status, result.note, result.keyLocation);
            }}
          >
            <SaveCheckIcon />
            حفظ النتيجة
          </Button>
        </div>
      </div>
    </div>
  );
}
