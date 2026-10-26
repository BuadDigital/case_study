using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Case Study bounded context.
/// Maps existing Case Study–owned tables in the <c>case_study</c> schema.
/// </summary>
public sealed class CaseStudyDbContext(DbContextOptions<CaseStudyDbContext> options)
    : DbContext(options)
{
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderProperty> WorkOrderProperties => Set<WorkOrderProperty>();
    // Decision 2026-10-18: the transaction above the deeds (replaces the removed property groups).
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<BuildingInventoryLine> BuildingInventoryLines => Set<BuildingInventoryLine>();
    public DbSet<PropertyContact> PropertyContacts => Set<PropertyContact>();
    public DbSet<WorkflowTask> WorkflowTasks => Set<WorkflowTask>();
    public DbSet<CaseStudyReport> CaseStudyReports => Set<CaseStudyReport>();
    public DbSet<PartyTaskSubmission> PartyTaskSubmissions => Set<PartyTaskSubmission>();
    public DbSet<FieldInspectionWorkspace> FieldInspectionWorkspaces =>
        Set<FieldInspectionWorkspace>();
    public DbSet<InternalDelegationLetterSet> InternalDelegationLetterSets =>
        Set<InternalDelegationLetterSet>();
    public DbSet<DocumentReferenceCounter> DocumentReferenceCounters =>
        Set<DocumentReferenceCounter>();
    public DbSet<NumberedDocument> NumberedDocuments => Set<NumberedDocument>();
    public DbSet<ReferenceSequence> ReferenceSequences => Set<ReferenceSequence>();
    public DbSet<PoIntakeDraft> PoIntakeDrafts => Set<PoIntakeDraft>();
    public DbSet<PropertyTimelineEntry> PropertyTimelineEntries => Set<PropertyTimelineEntry>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyCaseStudyModel();
}
