"use client";

import { OperationalPanel } from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import type { RoleId } from "@platform/types";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { PartyFeesWorkspace } from "../components/fees/PartyFeesWorkspace";

function feesVariantForRole(role: RoleId): "field-inspection" | "engineering-survey" | null {
  if (role === "field-inspector") return "field-inspection";
  if (role === "engineering-office") return "engineering-survey";
  return null;
}

export function PartyFeesView() {
  const { role, distributionAssigneeId, hasCapability } = usePrototype();
  const variant = feesVariantForRole(role);
  const isSupervisor = hasCapability("manage-operations");

  if (!variant && !isSupervisor) {
    return (
      <ActiveTransactionPageLayout
        pageId="party-fees"
        queuePanel={
          <OperationalPanel className="min-h-0 flex-1 flex-none p-0">
            <p className="p-4 text-sm text-text-3">
              لا تتوفر شاشة الاتعاب والفوتره لهذا الدور.
            </p>
          </OperationalPanel>
        }
      />
    );
  }

  return (
    <ActiveTransactionPageLayout
      pageId="party-fees"
      queuePanel={
        <OperationalPanel className="min-h-0 flex-1 flex-none p-0">
          <PartyFeesWorkspace
            variant={variant ?? "field-inspection"}
            assigneeId={isSupervisor ? undefined : distributionAssigneeId ?? undefined}
            isSupervisor={isSupervisor}
          />
        </OperationalPanel>
      }
    />
  );
}
