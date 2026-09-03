using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Loads work orders with properties/contacts for read and mutate paths.</summary>
public interface IWorkOrderLoader
{
    Task<WorkOrder?> LoadAsync(
        string poNumber,
        CancellationToken cancellationToken = default,
        bool asNoTracking = false);

    static string NormalizePo(string poNumber) => poNumber.Trim();

    static string? NormalizeOptionalText(string? value) => Texts.NullIfBlank(value);
}
