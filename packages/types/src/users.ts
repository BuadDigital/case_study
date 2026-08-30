type ContractType = "Internal" | "Freelance" | "ServiceProvider";
type RegistrationSourceApi = "Hr" | "Proc";
export type UserStatusApi = "Active" | "Disabled" | "PendingActivation" | "Locked";

type UserDetailField = {
  section: string;
  label: string;
  value: string;
};

export type UserListItem = {
  id: string;
  /** Numbering workshop: internal ref US-{year}-{5-digit seq}. */
  referenceNumber?: string | null;
  displayName: string;
  jobTitle: string;
  email: string;
  userName: string;
  roleId?: string | null;
  mobile?: string | null;
  city?: string | null;
  department?: string | null;
  nationalId?: string | null;
  avatarUrl?: string | null;
  inspectorType?: "employee" | "contractor" | null;
  hasCompensation?: boolean;
  feeValueSar?: number | null;
  iban?: string | null;
  taxNumber?: string | null;
  commercialRegistration?: string | null;
  joinedAt?: string | null;
  distributionAssigneeId?: string | null;
  reviewerCityCoverage?: string[];
  contractType: ContractType;
  status: UserStatusApi;
  registrationSource: RegistrationSourceApi;
  phoneNumber?: string | null;
  createdAtUtc?: string;
  lastLoginAtUtc?: string | null;
  systemRoles?: string[];
  details?: UserDetailField[];
};
