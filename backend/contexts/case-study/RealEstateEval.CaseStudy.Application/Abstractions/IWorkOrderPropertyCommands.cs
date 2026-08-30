using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Property-level mutations and Enfath mapping for work orders.</summary>
public interface IWorkOrderPropertyCommands
{
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateLocationMapUrlAsync(
        string poNumber,
        Guid propertyId,
        string? locationMapUrl,
        CancellationToken cancellationToken);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken);

    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken);

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
