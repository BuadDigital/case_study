using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Case Study bounded context (plan Phase 1, extraction order step 4).
/// Maps existing Case Study–owned tables in the <c>case_study</c> schema.
/// </summary>
public sealed class CaseStudyDbContext(DbContextOptions<CaseStudyDbContext> options)
    : DbContext(options)
{
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderProperty> WorkOrderProperties => Set<WorkOrderProperty>();
    public DbSet<PropertyContact> PropertyContacts => Set<PropertyContact>();
    public DbSet<WorkflowTask> WorkflowTasks => Set<WorkflowTask>();
    public DbSet<CaseStudyForm> CaseStudyForms => Set<CaseStudyForm>();
    public DbSet<PartyTaskSubmission> PartyTaskSubmissions => Set<PartyTaskSubmission>();
    public DbSet<FieldInspectionWorkspace> FieldInspectionWorkspaces =>
        Set<FieldInspectionWorkspace>();
    public DbSet<InternalDelegationLetterSet> InternalDelegationLetterSets =>
        Set<InternalDelegationLetterSet>();
    public DbSet<DocumentReferenceCounter> DocumentReferenceCounters =>
        Set<DocumentReferenceCounter>();
    public DbSet<PoIntakeDraft> PoIntakeDrafts => Set<PoIntakeDraft>();
    public DbSet<PropertyTimelineEntry> PropertyTimelineEntries => Set<PropertyTimelineEntry>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyCaseStudyModel();
}
