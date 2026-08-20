using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Persistence session for the <c>case_study</c> schema. Use-cases depend on this instead of
/// <see cref="CaseStudyDbContext"/>. Dedicated aggregate repositories (Clients, PO drafts)
/// remain the template for small CRUD.
/// </summary>
public interface ICaseStudyRepository
{
    DbSet<WorkOrder> WorkOrders { get; }
    DbSet<WorkOrderProperty> WorkOrderProperties { get; }
    DbSet<Client> Clients { get; }
    DbSet<BuildingInventoryLine> BuildingInventoryLines { get; }
    DbSet<PropertyContact> PropertyContacts { get; }
    DbSet<WorkflowTask> WorkflowTasks { get; }
    DbSet<CaseStudyForm> CaseStudyForms { get; }
    DbSet<PartyTaskSubmission> PartyTaskSubmissions { get; }
    DbSet<FieldInspectionWorkspace> FieldInspectionWorkspaces { get; }
    DbSet<InternalDelegationLetterSet> InternalDelegationLetterSets { get; }
    DbSet<DocumentReferenceCounter> DocumentReferenceCounters { get; }
    DbSet<PoIntakeDraft> PoIntakeDrafts { get; }
    DbSet<PropertyTimelineEntry> PropertyTimelineEntries { get; }
    DbSet<PropertyGroup> PropertyGroups { get; }
    DbSet<PropertyGroupMember> PropertyGroupMembers { get; }

    ChangeTracker ChangeTracker { get; }
    DatabaseFacade Database { get; }
    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
