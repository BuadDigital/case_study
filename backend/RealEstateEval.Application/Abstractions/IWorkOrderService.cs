using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IWorkOrderService
{
    Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkOrderDto>> ListDetailsAsync(CancellationToken cancellationToken);
    Task<WorkOrderDto?> GetByPoNumberAsync(string poNumber, CancellationToken cancellationToken);
    Task<bool> ExistsAsync(string poNumber, CancellationToken cancellationToken);
    Task<PriorDeedRegistrationDto?> FindPriorDeedAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        CancellationToken cancellationToken);
    Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateWorkOrderRequest request,
        CancellationToken cancellationToken);
    Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> UpdateHeaderAsync(
        string poNumber,
        UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> DeleteAsync(string poNumber, CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken);
    Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken);
    Task<(bool Ok, string? Error)> DeletePropertyAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken);
}
