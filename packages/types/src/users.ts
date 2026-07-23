export type ContractType = "Internal" | "Freelance" | "ServiceProvider";
export type RegistrationSourceApi = "Hr" | "Proc";
export type UserStatusApi = "Active" | "Inactive";

export type UserDetailField = {
  section: string;
  label: string;
  value: string;
};

export type UserListItem = {
  id: string;
  displayName: string;
  jobTitle: string;
  email: string;
  userName: string;
  distributionAssigneeId?: string | null;
  reviewerCityCoverage?: string[];
  contractType: ContractType;
  status: UserStatusApi;
  registrationSource: RegistrationSourceApi;
  phoneNumber?: string | null;
  createdAtUtc?: string;
  systemRoles?: string[];
  details?: UserDetailField[];
};

export type FieldErrorsResponse = {
  errors: Record<string, string>;
};
