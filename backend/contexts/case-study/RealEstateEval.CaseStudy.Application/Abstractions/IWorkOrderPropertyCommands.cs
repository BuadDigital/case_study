using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Property-level mutations and Enfath mapping for work orders.</summary>
public interface IWorkOrderPropertyCommands
{
    /// <param name="softDraft">
    /// True when the specialist has just opened an empty slot: the property is created with its
    /// real id before anything is typed (no required-field gate), so uploads never need a
    /// client-side id. The explicit حفظ still validates fully.
    /// </param>
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false,
        string? actorName = null);


    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken,
        PartySubmissionActor? actor = null);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken,
        string? actorName = null);

    Task<(bool Ok, string? Error)> DeletePropertyAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken);

    WorkOrderProperty MapPropertyEnfath(
        WorkOrderPropertyDto dto,
        Guid workOrderId,
        bool forInsert);
}
