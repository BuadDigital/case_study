"use client";

/**
 * Wizard step 2 card of `InspectorWorkspaceWizard` - the deed-vs-reality
 * boundary match table (facade type, match verdict, mismatch note).
 */

import { cn, Select } from "@platform/ui-kit";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  PROPERTY_BOUNDARY_ROWS,
  boundariesMarkedUnavailable,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import type {
  InspectorBoundaryKey,
  InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  InsCard,
  EDIT_CONTROL_CLASS,
} from "../po-intake/PropertyDetailInspectionParts";
import { INS_TD_CLASS, INS_TH_CLASS } from "./FieldInspectionWorkParts";
import { useFacadeOptions } from "../../query/use-facade-options";
import { FALLBACK_FACADE_OPTIONS } from "./inspector-wizard-state";

export function InspectorBoundaryMatchTable({
  property,
  draft,
  editable,
  onPatch,
}: {
  property: PoPropertyIntake;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
}) {
  const catalogFacadeOptions = useFacadeOptions();
  const facadeTypeOptions = catalogFacadeOptions ?? FALLBACK_FACADE_OPTIONS;

  return (
    <>
      {!boundariesMarkedUnavailable(property.boundariesAvailability) ? (
        <InsCard
          title="الحدود والأطوال"
          badge={
            <DetailBadge tone="teal">
              للمطابقة — المصدر: الأخصائي (البورصة)
            </DetailBadge>
          }
        >
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-3">
            دور المعاين هنا مطابقة بيانات البورصة واكتشاف الخطأ — يؤكد المطابقة أو
            يعلّق بعدم المطابقة.
          </p>
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
                      "مطابق للواقع",
                      "ملاحظة عدم التطابق",
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
                  const ok = match?.matches !== false;
                  const facadeKey = `boundaryFacade:${matchKey}`;
                  return (
                    <tr key={row.descKey}>
                      <td className={cn(INS_TD_CLASS, "font-bold text-heading")}>
                        {row.label}
                      </td>
                      <td className={INS_TD_CLASS}>
                        <Select
                          className="text-[11.5px]"
                          disabled={!editable}
                          value={draft.featureValues[facadeKey] ?? ""}
                          onChange={(e) =>
                            editable &&
                            onPatch({
                              featureValues: {
                                ...draft.featureValues,
                                [facadeKey]: e.target.value,
                              },
                            })
                          }
                        >
                          <option value="">— اختر —</option>
                          {facadeTypeOptions.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className={INS_TD_CLASS}>
                        {property[row.descKey].trim() || "—"}
                      </td>
                      <td
                        className={cn(INS_TD_CLASS, "text-center tabular-nums")}
                        dir="ltr"
                      >
                        {property[row.lenKey].trim()
                          ? `${property[row.lenKey].trim()} م`
                          : "—"}
                      </td>
                      <td className={cn(INS_TD_CLASS, "text-center")}>
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            disabled={!editable}
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                              !editable && "cursor-default",
                              ok
                                ? "border-[color-mix(in_srgb,#1f6f6f_35%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
                                : "border-border bg-surface-2 text-text-3",
                            )}
                            onClick={() =>
                              editable &&
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
                            disabled={!editable}
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                              !editable && "cursor-default",
                              !ok
                                ? "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-danger-bg text-danger-text"
                                : "border-border bg-surface-2 text-text-3",
                            )}
                            onClick={() =>
                              editable &&
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
                      </td>
                      <td className={INS_TD_CLASS}>
                        {!ok ? (
                          editable ? (
                          <input
                            className={cn(EDIT_CONTROL_CLASS, "text-[11.5px]")}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </InsCard>
      ) : null}
    </>
  );
}
