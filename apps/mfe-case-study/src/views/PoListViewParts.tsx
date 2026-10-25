"use client";

/**
 * Presentational pieces of `PoListView` — the portal hover card (re-exported
 * from `components/ui/HoverPortalCard`), the team avatar stack, the status pill, and the toolbar/empty-state icons. No queries
 * and no writes; rules live in `po-list-view-state.ts`.
 */

import type { PoRow } from "@platform/app-shared/app-data/constants";
import { poListStatusMeta } from "@platform/app-shared/app-data/po-list-status";
import { cn, StatusPill } from "@platform/ui-kit";
import { HoverPortalCard } from "../components/ui/HoverPortalCard";
import {
  poStatusStyle,
  TEAM_COLORS,
  teamInitial,
} from "./po-list-view-state";

export { HoverPortalCard };

type TeamStackMember = string | { name: string; role?: string };

function teamMemberName(member: TeamStackMember): string {
  return typeof member === "string" ? member : member.name;
}

function teamMemberRole(member: TeamStackMember): string | undefined {
  return typeof member === "string" ? undefined : member.role?.trim();
}

export function TeamStack({ members }: { members: TeamStackMember[] }) {
  const rows = members.filter((member) => teamMemberName(member).trim());
  if (rows.length === 0) {
    return <span className="font-normal text-text-3">—</span>;
  }
  const shown = rows.slice(0, 3);
  const extra = rows.length - shown.length;
  return (
    <HoverPortalCard
      align="end"
      panelClassName="min-w-[190px] rounded-[10px] border border-border-md bg-surface p-2 shadow-[0_8px_24px_-8px_rgba(18,40,76,.28)]"
      content={
        <>
          <div className="px-2 pb-1.5 pt-0.5 text-[11px] font-bold text-text-3">
            فريق المعاملة ({rows.length})
          </div>
          {rows.map((member, i) => {
            const name = teamMemberName(member);
            const role = teamMemberRole(member);
            return (
              <div
                key={`pop-${name}-${i}`}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
              >
                <span
                  className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
                >
                  {teamInitial(name)}
                </span>
                {role ? (
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[11px] font-bold text-text-3">
                      {role}
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-semibold text-heading">
                      {name}
                    </span>
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-[13px] font-semibold text-heading">
                    {name}
                  </span>
                )}
              </div>
            );
          })}
        </>
      }
    >
      <span className="inline-flex w-fit items-center">
      {shown.map((member, i) => {
        const name = teamMemberName(member);
        return (
          <span
            key={`${name}-${i}`}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface text-[11px] font-bold text-white",
              i > 0 && "-ms-2",
            )}
            style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
            title={teamMemberRole(member) ? `${teamMemberRole(member)} — ${name}` : name}
          >
            {teamInitial(name)}
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="-ms-2 grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface bg-surface-2 text-[11px] font-bold text-heading">
          +{extra}
        </span>
      ) : null}
      </span>
    </HoverPortalCard>
  );
}

export function PoStatusPill({ status }: { status: PoRow["status"] }) {
  const { label } = poListStatusMeta(status);
  return <StatusPill label={label} style={poStatusStyle(status)} />;
}

export function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SortIcon() {
  return (
    <svg
      className="ms-0.5 opacity-70"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}

export function InboxIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M4 4h16v12H4zM4 12l4 4h8l4-4" />
    </svg>
  );
}
