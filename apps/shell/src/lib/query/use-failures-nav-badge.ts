"use client";

import { useMemo } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  countOpenFailures,
  countOpenFailuresForGovernmentReviewer,
  countOpenFailuresForEngineeringOffice,
} from "@failures/mfe";
import { useFailuresQuery } from "@/lib/query/prototype-queries";

/** Live red badge count for إدارة التعذرات in the sidebar. */
export function useFailuresNavBadge(): number {
  const { role, rolePages } = usePrototype();
  const { data: failures = [] } = useFailuresQuery();

  return useMemo(() => {
    if (!rolePages.includes("failures")) return 0;
    if (role === "government-reviewer") {
      return countOpenFailuresForGovernmentReviewer(failures);
    }
    if (role === "engineering-office") {
      return countOpenFailuresForEngineeringOffice(failures);
    }
    return countOpenFailures(failures);
  }, [role, rolePages, failures]);
}
