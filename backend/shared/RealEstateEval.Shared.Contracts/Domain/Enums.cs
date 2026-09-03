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
}

public enum UserStatus
{
    Active = 0,
    Disabled = 1,
    PendingActivation = 2,
    Locked = 3,
}

public enum ProcProviderKind
{
    Individual = 0,
    Organization = 1,
}
