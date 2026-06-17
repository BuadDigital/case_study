namespace RealEstateEval.Domain;

public enum ContractType
{
    Internal = 0,
    Freelance = 1,
    ServiceProvider = 2,
}

public enum RegistrationSource
{
    Hr = 0,
    Proc = 1,
    Crm = 2,
}

public enum UserStatus
{
    Active = 0,
    Inactive = 1,
}

public enum ProcProviderKind
{
    Individual = 0,
    Organization = 1,
}

public enum CrmEntityKind
{
    Individual = 0,
    Company = 1,
}

public enum CrmClientStatus
{
    Lead = 0,
    Active = 1,
}

public enum CrmClientType
{
    Direct = 0,
    Contract = 1,
}
