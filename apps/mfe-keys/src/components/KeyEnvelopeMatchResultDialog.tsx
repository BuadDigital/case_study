"use client";

/**
 * Field match result for one deed — the tile picker plus the note that is
 * mandatory for anything but a full match. Validation lives in
 * `key-envelope-dialogs-state`; the parent persists the chosen status.
 */
import { useState } from "react";
import { Button, Input, Label, cn } from "@platform/ui-kit";
import type { KeyAssignmentMatchStatus } from "../lib/keys-envelope-types";
import { MATCH_RESULT_TILES } from "./key-envelope-detail-state";
import { validateMatchResult } from "./key-envelope-dialogs-state";
import { DialogErrorBanner, SaveCheckIcon } from "./KeyEnvelopeDialogShared";

export function MatchResultModal({
  deed,
  busy,
  onClose,
  onSave,
}: {
  deed: string;
  busy: boolean;
  onClose: () => void;
  onSave: (status: KeyAssignmentMatchStatus, note?: string) => void;
}) {
  const [sel, setSel] = useState<KeyAssignmentMatchStatus | "">("");
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
              {MATCH_RESULT_TILES.map((t) => {
                const on = sel === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "flex min-h-[52px] items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 text-start font-[inherit] transition-all duration-100",
                      on
                        ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                        : "border-border-md bg-surface-2",
                    )}
                    onClick={() => {
                      setSel(t.id);
                      setErr("");
                    }}
                  >
                    <span
                      className="size-3.5 shrink-0 rounded-full border-2"
                      style={{
                        borderColor: t.color,
                        background: on ? t.color : "transparent",
                      }}
                    />
                    <span>
                      <span
                        className="block text-[13.5px] font-extrabold"
                        style={{ color: t.color }}
                      >
                        {t.label}
                      </span>
                      <span className="mt-px block text-[11.5px] text-text-3">
                        {t.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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
              const result = validateMatchResult(sel, note);
              if (!result.ok) {
                setErr(result.error);
                return;
              }
              onSave(result.status, result.note);
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
