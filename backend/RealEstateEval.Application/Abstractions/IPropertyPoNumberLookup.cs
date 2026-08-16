namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Reads the work-order number a property belongs to. Case Study owns those rows, so
/// contexts outside it ask through this interface instead of joining to
/// <c>case_study.WorkOrderProperties</c>.
/// </summary>
public interface IPropertyPoNumberLookup
{
 /// <summary>Empty when the id is not a property GUID or the property is unknown.</summary>
    Task<string> ResolveForPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default);
}
