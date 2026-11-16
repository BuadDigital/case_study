import { cn } from "@platform/ui-kit";

export type PropertyBoundariesTableRow = {
  /** «الحد الشمالي». */
  label: string;
  desc: string;
  /** The side's length without its unit. */
  len: string;
  /** «نوع الواجهة» — drawn only with `showInspection`. */
  facade?: string;
  /** The inspector's verdict («مطابق» / «غير مطابق») — drawn only with `showInspection`. */
  match?: string;
  /** His note on a side that does not match. */
  note?: string;
};

const HEAD = "border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-bold text-text-2";

/**
 * The property's four sides: the boundary and its length — and, with `showInspection`, the facade
 * type and the inspector's verdict on each side (the appraiser's summary).
 * Edge cases: an empty cell reads «—»; a side that does not match is amber, with its note under it;
 * a phone scrolls the wider table inside its own box.
 */
export function PropertyBoundariesTable({
  rows,
  showInspection = false,
  showFacade = true,
}: {
  rows: PropertyBoundariesTableRow[];
  showInspection?: boolean;
  /** false on land in any form and on an apartment — no «نوع الواجهة» column (Omar 2026-11-16). */
  showFacade?: boolean;
}) {
  return (
    <div className={cn("rounded border border-border", showInspection ? "overflow-x-auto" : "overflow-hidden")}>
      <table className={cn("w-full border-collapse text-xs", showInspection && "min-w-[560px]")}>
        <thead>
          <tr>
            <th className={cn(HEAD, "text-start")}>الحد</th>
            <th className={cn(HEAD, "text-center")}>وصف الحد</th>
            <th className={cn(HEAD, "text-center")}>طول الضلع</th>
            {showInspection ? (
              <>
                {showFacade ? <th className={cn(HEAD, "text-center")}>نوع الواجهة</th> : null}
                <th className={cn(HEAD, "text-center")}>على الطبيعة (المعاين)</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rule = i < rows.length - 1 && "border-b border-border";
            return (
              <tr key={row.label}>
                <td className={cn("px-3 py-2 font-semibold text-heading", rule)}>{row.label}</td>
                <td className={cn("px-3 py-2 text-center text-text", rule)}>{row.desc || "—"}</td>
                <td className={cn("px-3 py-2 text-center tabular-nums text-text [direction:ltr]", rule)}>
                  {row.len ? `${row.len} م` : "—"}
                </td>
                {showInspection ? (
                  <>
                    {showFacade ? (
                      <td className={cn("px-3 py-2 text-center text-text", rule)}>{row.facade || "—"}</td>
                    ) : null}
                    <td className={cn("px-3 py-2 text-center text-text", rule)}>
                      {row.match === "غير مطابق" ? (
                        <span className="font-bold text-amber-text">{row.match}</span>
                      ) : (
                        row.match || "—"
                      )}
                      {row.note ? <div className="mt-0.5 text-[11px] text-text-2">{row.note}</div> : null}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
