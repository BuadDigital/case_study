import type {
  DelegationLetterAgentDto,
  DelegationLetterPropertyDto,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";

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
  const reg = user?.registration ?? {};
  const nationality =
    reg.nationality?.trim() ||
    reg.الجنسية?.trim() ||
    "—";
  const nationalId =
    reg.nationalId?.trim() ||
    reg.national_id?.trim() ||
    reg.الهوية?.trim() ||
    reg.idNumber?.trim() ||
    "—";
  return {
    name: user?.name?.trim() || "—",
    nationality,
    nationalId,
    mobile: user?.phone?.trim() || "—",
  };
}
