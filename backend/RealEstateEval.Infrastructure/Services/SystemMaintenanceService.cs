using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public class SystemMaintenanceService : ISystemMaintenanceService
{
    private readonly ApplicationDbContext _db;
    private readonly IUserRegistrationService _users;
    private readonly IServiceProvider _services;

    public SystemMaintenanceService(
        ApplicationDbContext db,
        IUserRegistrationService users,
        IServiceProvider services)
    {
        _db = db;
        _users = users;
        _services = services;
    }

    public async Task<SystemResetResultDto> ResetAllOperationalDataAsync(
        CancellationToken cancellationToken = default)
    {
        var caseStudyForms = await _db.CaseStudyForms.CountAsync(cancellationToken);
        var workflowTasks = await _db.WorkflowTasks.CountAsync(cancellationToken);
        var workOrders = await _db.WorkOrders.CountAsync(cancellationToken);
        var courts = await _db.CourtCatalogEntries.CountAsync(cancellationToken);
        var infoRoles = await _db.CaseStudyInfoRolesConfigs.CountAsync(cancellationToken);
        var propertyFailures = await _db.PropertyFailures.CountAsync(cancellationToken);
        var poIntakeDrafts = await _db.PoIntakeDrafts.CountAsync(cancellationToken);
        var attachments = await _db.FileAttachments.CountAsync(cancellationToken);
        var delegationLetterSets = await _db.InternalDelegationLetterSets.CountAsync(cancellationToken);
        var evaluatorRecalls = await _db.EvaluatorRecallRecords.CountAsync(cancellationToken);
        var fieldDictionaryConfigs = await _db.FieldDictionaryConfigs.CountAsync(cancellationToken);
        var failureTypesCatalogConfigs = await _db.FailureTypesCatalogConfigs.CountAsync(cancellationToken);
        var surveyOffices = await _db.SurveyOffices.CountAsync(cancellationToken);
        var valuationRequests = await _db.ValuationRequests.CountAsync(cancellationToken);
        var propertyKeyRecords = await _db.PropertyKeyRecords.CountAsync(cancellationToken);
        var financialReportConfigs = await _db.FinancialReportConfigs.CountAsync(cancellationToken);

        var blobKeys = await _db.FileAttachments.AsNoTracking()
            .Where(a => a.StorageKey != null && a.StorageKey != "")
            .Select(a => a.StorageKey!)
            .ToListAsync(cancellationToken);
        var blobs = _services.GetService<IBlobStorage>();
        if (blobs is not null)
        {
            foreach (var key in blobKeys)
                await blobs.DeleteAsync(key, cancellationToken);
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction =
                await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                await _db.CaseStudyForms.ExecuteDeleteAsync(cancellationToken);
                await _db.FieldInspectionWorkspaces.ExecuteDeleteAsync(cancellationToken);
                await _db.PartyTaskSubmissions.ExecuteDeleteAsync(cancellationToken);
                await _db.PropertyFailures.ExecuteDeleteAsync(cancellationToken);
                await _db.WorkflowTasks.ExecuteDeleteAsync(cancellationToken);
                await _db.PropertyContacts.ExecuteDeleteAsync(cancellationToken);
                await _db.WorkOrderProperties.ExecuteDeleteAsync(cancellationToken);
                await _db.WorkOrders.ExecuteDeleteAsync(cancellationToken);
                await _db.CourtCatalogEntries.ExecuteDeleteAsync(cancellationToken);
                await _db.CaseStudyInfoRolesConfigs.ExecuteDeleteAsync(cancellationToken);
                await _db.PoIntakeDrafts.ExecuteDeleteAsync(cancellationToken);
                await _db.FileAttachments.ExecuteDeleteAsync(cancellationToken);
                await _db.InternalDelegationLetterSets.ExecuteDeleteAsync(cancellationToken);
                await _db.EvaluatorRecallRecords.ExecuteDeleteAsync(cancellationToken);
                await _db.FieldDictionaryConfigs.ExecuteDeleteAsync(cancellationToken);
                await _db.FailureTypesCatalogConfigs.ExecuteDeleteAsync(cancellationToken);
                await _db.PropertyKeyRecords.ExecuteDeleteAsync(cancellationToken);
                await _db.KeyEnvelopeTimelineEntries.ExecuteDeleteAsync(cancellationToken);
                await _db.KeyEnvelopeHandoffs.ExecuteDeleteAsync(cancellationToken);
                await _db.KeyEnvelopeAssignments.ExecuteDeleteAsync(cancellationToken);
                await _db.KeyReceiptFeeCharges.ExecuteDeleteAsync(cancellationToken);
                await _db.CourtVisitFeeCharges.ExecuteDeleteAsync(cancellationToken);
                await _db.KeyEnvelopes.ExecuteDeleteAsync(cancellationToken);
                await _db.PropertyCourtAccesses.ExecuteDeleteAsync(cancellationToken);
                await _db.ValuationRequests.ExecuteDeleteAsync(cancellationToken);
                await _db.SurveyOffices.ExecuteDeleteAsync(cancellationToken);
                await _db.FinancialReportConfigs.ExecuteDeleteAsync(cancellationToken);
                await _db.OutboxMessages.ExecuteDeleteAsync(cancellationToken);

                var registeredUsersDeleted =
                    await _users.DeleteAllRegisteredAsync(cancellationToken);
                await DataSeeder.ReseedAllDemoUsersAsync(_services, cancellationToken);
                await DataSeeder.ReseedPrototypeModuleDataAsync(_db, cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                return new SystemResetResultDto
                {
                    WorkOrdersDeleted = workOrders,
                    WorkflowTasksDeleted = workflowTasks,
                    CaseStudyFormsDeleted = caseStudyForms,
                    CourtCatalogEntriesDeleted = courts,
                    CaseStudyInfoRolesConfigsDeleted = infoRoles,
                    PropertyFailuresDeleted = propertyFailures,
                    RegisteredUsersDeleted = registeredUsersDeleted,
                    PoIntakeDraftsDeleted = poIntakeDrafts,
                    AttachmentsDeleted = attachments,
                    InternalDelegationLetterSetsDeleted = delegationLetterSets,
                    EvaluatorRecallsDeleted = evaluatorRecalls,
                    FieldDictionaryConfigsDeleted = fieldDictionaryConfigs,
                    FailureTypesCatalogConfigsDeleted = failureTypesCatalogConfigs,
                    SurveyOfficesDeleted = surveyOffices,
                    ValuationRequestsDeleted = valuationRequests,
                    PropertyKeyRecordsDeleted = propertyKeyRecords,
                    FinancialReportConfigsDeleted = financialReportConfigs,
                };
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }
}
