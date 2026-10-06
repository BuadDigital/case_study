"use client";

/**
 * Wizard step 2 card of `InspectorWorkspaceWizard` - deed text/length plus
 * facade type, match verdict, and mismatch note.
 */

import { cn, Select } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  PROPERTY_BOUNDARY_ROWS,
  boundariesMarkedUnavailable,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  effectiveDeedVerdict,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  InsCard,
  EDIT_CONTROL_CLASS,
} from "../po-intake/PropertyDetailInspectionParts";
import { INS_TD_CLASS, INS_TH_CLASS } from "./FieldInspectionWorkParts";
import { InspectorDeedVerdict } from "./InspectorDeedVerdict";
import { useFacadeOptions } from "../../query/use-facade-options";
import { FALLBACK_FACADE_OPTIONS } from "./inspector-wizard-state";
import {
  boundaryMatchPatch,
  resolvedBoundaryDeedField,
} from "./field-inspection-work-state";

export function InspectorBoundaryMatchTable({
  property,
  draft,
  editable,
  mismatchNoteInvalidKey,
  onPatch,
}: {
  property: PoPropertyIntake;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  mismatchNoteInvalidKey?: string;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const catalogFacadeOptions = useFacadeOptions();
  const facadeTypeOptions = catalogFacadeOptions ?? FALLBACK_FACADE_OPTIONS;
  // Per-side verdicts + notes only under «غير مطابق» (explicit, or derived from a legacy payload).
  const showMatchCols = effectiveDeedVerdict(draft) === "no";

  return (
    <>
      {!boundariesMarkedUnavailable(property.boundariesAvailability) ? (
        <div id="ins-boundaries-section">
        <InsCard
          title="الحدود والأطوال"
          badge={
            editable ? (
              <DetailBadge tone="teal">
                أدخل الحدود ثم طابقها مع الواقع
              </DetailBadge>
            ) : undefined
          }
        >
          {editable ? (
            <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-3">
              أدخل الحد حسب الصك وطوله إن لم تُعبأ من البورصة، ثم أكّد المطابقة أو
              علّق بعدم المطابقة.
            </p>
          ) : null}
          <InspectorDeedVerdict
            draft={draft}
            mobile={false}
            readOnly={!editable}
            onPatch={onPatch}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr>
                  {(
                    [
                      "الجهة",
                      "نوع الواجهة",
                      "الحد حسب الصك",
                      "الطول (م)",
                      ...(showMatchCols
                        ? (["مطابق للواقع", "ملاحظة عدم التطابق"] as const)
                        : []),
                    ] as const
                  ).map((h) => (
                    <th
                      key={h}
                      className={INS_TH_CLASS}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROPERTY_BOUNDARY_ROWS.map((row) => {
                  const matchKey = row.descKey.replace(
                    "Boundary",
                    "",
                  ) as InspectorBoundaryKey;
                  const match = draft.boundaryMatches[matchKey];
                  // Tri-state: an untouched side (null) is neither «مطابق» nor «غير مطابق».
                  const ok = match?.matches === true;
                  const bad = match?.matches === false;
                  const deedDesc = resolvedBoundaryDeedField(
                    match?.deedDesc,
                    property[row.descKey],
                  );
                  const deedLength = resolvedBoundaryDeedField(
                    match?.deedLength,
                    property[row.lenKey],
                  );
                  const facade = resolvedBoundaryDeedField(
                    match?.facade,
                    property[row.facadeKey],
                  );
                  return (
                    <tr key={row.descKey} id={`ins-boundary-${matchKey}`}>
                      <td className={cn(INS_TD_CLASS, "font-bold text-heading")}>
                        {row.label}
                      </td>
                      <td className={INS_TD_CLASS}>
                        {editable ? (
                        <Select
                          className="text-[11.5px]"
                          value={facade}
                          onChange={(e) =>
                            onPatch(
                              boundaryMatchPatch(draft, matchKey, {
                                facade: e.target.value,
                              }),
                            )
                          }
                        >
                          <option value="">— اختر —</option>
                          {facade && !facadeTypeOptions.includes(facade) ? (
                            <option value={facade}>{facade}</option>
                          ) : null}
                          {facadeTypeOptions.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </Select>
                        ) : (
                          facade.trim() || "—"
                        )}
                      </td>
                      <td className={INS_TD_CLASS}>
                        {editable ? (
                          <input
                            className={cn(EDIT_CONTROL_CLASS, "text-[11.5px]")}
                            placeholder="مثال: شارع عرض 15م"
                            aria-label={`الحد حسب الصك — ${row.label}`}
                            value={deedDesc}
                            onChange={(e) =>
                              onPatch(
                                boundaryMatchPatch(draft, matchKey, {
                                  deedDesc: e.target.value,
                                }),
                              )
                            }
                          />
                        ) : (
                          deedDesc.trim() || "—"
                        )}
                      </td>
                      <td
                        className={cn(INS_TD_CLASS, "text-center tabular-nums")}
                        dir="ltr"
                      >
                        {editable ? (
                          <input
                            className={cn(
                              EDIT_CONTROL_CLASS,
                              "text-center text-[11.5px]",
                            )}
                            placeholder="25.00"
                            inputMode="decimal"
                            aria-label={`الطول (م) — ${row.label}`}
                            value={deedLength}
                            onChange={(e) =>
                              onPatch(
                                boundaryMatchPatch(draft, matchKey, {
                                  deedLength: e.target.value,
                                }),
                              )
                            }
                          />
                        ) : (
                          deedLength.trim() ? `${deedLength.trim()} م` : "—"
                        )}
                      </td>
                      {showMatchCols ? (
                        <>
                      <td className={cn(INS_TD_CLASS, "text-center")}>
                        {!editable ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                              ok && "bg-success-bg text-heading",
                              bad && "bg-danger-bg text-danger-text",
                              !ok && !bad && "bg-surface-2 text-text-3",
                            )}
                          >
                            {ok ? "مطابق" : bad ? "غير مطابق" : "—"}
                          </span>
                        ) : (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                              ok
                                ? "border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg text-heading"
                                : "border-border bg-surface-2 text-text-3",
                            )}
                            onClick={() =>
                              onPatch({
                                boundaryMatches: {
                                  ...draft.boundaryMatches,
                                  [matchKey]: {
                                    ...match,
                                    matches: true,
                                    mismatchNote: "",
                                  },
                                },
                              })
                            }
                          >
                            مطابق
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                              bad
                                ? "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-danger-bg text-danger-text"
                                : "border-border bg-surface-2 text-text-3",
                            )}
                            onClick={() =>
                              onPatch({
                                boundaryMatches: {
                                  ...draft.boundaryMatches,
                                  [matchKey]: {
                                    ...match,
                                    matches: false,
                                  },
                                },
                              })
                            }
                          >
                            غير مطابق
                          </button>
                        </div>
                        )}
                      </td>
                      <td className={INS_TD_CLASS}>
                        {bad ? (
                          editable ? (
                          <input
                            className={cn(
                              EDIT_CONTROL_CLASS,
                              "text-[11.5px]",
                              mismatchNoteInvalidKey === matchKey &&
                                invalidControlClass,
                            )}
                            placeholder="ملاحظة عدم التطابق…"
                            value={match?.mismatchNote ?? ""}
                            onChange={(e) =>
                              onPatch({
                                boundaryMatches: {
                                  ...draft.boundaryMatches,
                                  [matchKey]: {
                                    ...match,
                                    mismatchNote: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                          ) : (
                            <span className="text-[11.5px] text-text">
                              {match?.mismatchNote?.trim() || "—"}
                            </span>
                          )
                        ) : (
                          <span className="text-text-3">—</span>
                        )}
                      </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </InsCard>
        </div>
      ) : null}
    </>
  );
}
