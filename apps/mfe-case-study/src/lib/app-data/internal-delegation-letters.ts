import type {
  DelegationLetterAgentDto,
  DelegationLetterPropertyDto,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";

export type DelegationLetterProperty = DelegationLetterPropertyDto;

export type DelegationAgentInfo = DelegationLetterAgentDto;

/** Shape used by printInternalDelegationLetter (ops-task snapshot → HTML). */
export type InternalDelegationLetter = {
  id: string;
  city: string;
  court: string;
  circuit: string;
  selectedProperties: DelegationLetterProperty[];
  poNumbers: string[];
  reference?: string;
  dateHijri?: string;
  dateGreg?: string;
  issuedAt?: string;
  agent?: DelegationAgentInfo;
  issuedProperties?: DelegationLetterProperty[];
  createdAt: string;
};

export function agentInfoFromStaff(
  user: StaffUser | null | undefined,
): DelegationAgentInfo {
  return {
    name: user?.name?.trim() || "—",
    nationality: "—",
    nationalId: user?.nationalId?.trim() || "—",
    mobile: user?.phone?.trim() || "—",
  };
}
