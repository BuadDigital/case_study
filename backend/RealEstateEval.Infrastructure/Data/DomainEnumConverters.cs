using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Keeps the typed domain vocabularies stored as the strings that are already in the database.
/// The columns stay <c>character varying</c>, existing rows keep working, and the read side is
/// lenient: an unrecognised legacy value materializes as the vocabulary's default instead of
/// throwing and taking a whole list endpoint down with it.
/// </summary>
internal static class DomainEnumConverters
{
    public static readonly ValueConverter<RealEstateEval.Domain.WorkflowTaskKind, string> WorkflowTaskKind =
        new(kind => kind.ToDbValue(), value => WorkflowTaskKindValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.WorkflowTaskPhase, string> WorkflowTaskPhase =
        new(phase => phase.ToDbValue(), value => WorkflowTaskPhaseValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.WorkflowTaskStatus, string> WorkflowTaskStatus =
        new(status => status.ToDbValue(), value => WorkflowTaskStatusValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.OperationsTaskType, string> OperationsTaskType =
        new(type => type.ToDbValue(), value => OperationsTaskTypeValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.OperationsTaskScope, string> OperationsTaskScope =
        new(scope => scope.ToDbValue(), value => OperationsTaskScopeValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.OperationsTaskStatus, string> OperationsTaskStatus =
        new(status => status.ToDbValue(), value => OperationsTaskStatusValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.OperationsTaskPriority, string> OperationsTaskPriority =
        new(priority => priority.ToDbValue(), value => OperationsTaskPriorityValues.Parse(value));

    public static readonly ValueConverter<RealEstateEval.Domain.ValuationRequestStatus, string> ValuationRequestStatus =
        new(status => status.ToDbValue(), value => ValuationRequestStatuses.Parse(value));
}
