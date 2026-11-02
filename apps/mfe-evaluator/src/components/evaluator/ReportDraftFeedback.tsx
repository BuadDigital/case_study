"use client";

import { Note, Spinner } from "@platform/ui-kit";

export type Refusal = { title: string; lines: string[] };

/** Every reason a refusal names (the server lists each blocker as its own error), never only the first. */
export function refusalLines(
  res: { message?: string; errors?: Record<string, string> },
  fallback: string,
): string[] {
  const fromErrors = Object.values(res.errors ?? {}).map((m) => (m ?? "").trim());
  const fromMessage = (res.message ?? "").split(/\r?\n/).map((m) => m.trim());
  const lines = [...new Set([...fromErrors, ...fromMessage].filter(Boolean))];
  return lines.length ? lines : [fallback];
}

/** A refused approval / deposit stays on screen with all its reasons (a toast vanished with them). */
export function RefusalPanel({ refusal, onClose }: { refusal: Refusal; onClose: () => void }) {
  return (
    <Note tone="danger" role="alert" className="mb-0" data-testid="report-approval-refusal">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-[12.5px]">{refusal.title}</strong>
        <button type="button" className="text-[11.5px] underline" onClick={onClose}>
          إخفاء
        </button>
      </div>
      <ul className="m-0 mt-1 list-disc ps-5">
        {refusal.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Note>
  );
}

/** The step the long actions are on — approval builds and uploads the printed report, the deposit renders the final PDF. */
export function PhaseNote({ phase, hint }: { phase: string | null; hint?: string }) {
  if (!phase) return null;
  return (
    <p className="m-0 flex items-center gap-2 text-[12px] text-text-2" role="status" aria-live="polite">
      <Spinner />
      <span>
        {phase}
        {hint ? <span className="text-text-3"> — {hint}</span> : null}
      </span>
    </p>
  );
}
