"use client";

import { PageShell, cn } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { RoleId } from "@platform/types";
import { PartyFeesWorkspace } from "../components/fees/PartyFeesWorkspace";
import type { PartyFeesVariant } from "../components/field-inspection/InspectorFeesTab";
import { opsTfNote } from "../lib/app-data/ops-tasks-tw";
import { Roles } from "@platform/types";

/** Role → party fees lane (one module shell, per-party content). */
function feesVariantForRole(role: RoleId): PartyFeesVariant | null {
  if (role === Roles.FieldInspector) return "field-inspection";
  if (role === Roles.EngineeringOffice) return "engineering-survey";
  if (role === Roles.GovernmentReviewer) return "court-visit";
  return null;
}

export function PartyFeesView() {
  const { role, distributionAssigneeId, hasCapability } = useAppAccess();
  const variant = feesVariantForRole(role);
  // Party roles keep office UI even if they also hold manage-operations.
  const isSupervisor = hasCapability("manage-operations") && !variant;

  if (!variant && !isSupervisor) {
    return (
      <PageShell
        variant="canvas"
        className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
        dir="rtl"
      >
        <p className={cn(opsTfNote, "m-0")}>
          لا تتوفر شاشة الاتعاب والفوتره لهذا الدور.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      <PartyFeesWorkspace
        variant={variant ?? "field-inspection"}
        assigneeId={
          isSupervisor ? undefined : (distributionAssigneeId ?? undefined)
        }
        isSupervisor={isSupervisor}
      />
    </PageShell>
  );
}
