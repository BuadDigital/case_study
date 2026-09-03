using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Operations bounded context :
/// key envelopes, survey offices, property-key records, court access, and operations tasks
/// (tasks still physically in <c>case_study</c> per D2).
/// <para>
/// Financial charges created inside operations transactions
/// (<c>KeyReceiptFeeCharges</c>, <c>CourtVisitFeeCharges</c>) stay on the legacy context until
/// the Financial slice; writers use both contexts in the shared database window.
/// </para>
/// </summary>
public sealed class OperationsDbContext(DbContextOptions<OperationsDbContext> options)
    : DbContext(options)
{
    public DbSet<SurveyOffice> SurveyOffices => Set<SurveyOffice>();
    public DbSet<PropertyKeyRecord> PropertyKeyRecords => Set<PropertyKeyRecord>();
    public DbSet<KeyEnvelope> KeyEnvelopes => Set<KeyEnvelope>();
    public DbSet<KeyEnvelopeAssignment> KeyEnvelopeAssignments => Set<KeyEnvelopeAssignment>();
    public DbSet<KeyEnvelopeHandoff> KeyEnvelopeHandoffs => Set<KeyEnvelopeHandoff>();
    public DbSet<KeyEnvelopeTimelineEntry> KeyEnvelopeTimelineEntries =>
        Set<KeyEnvelopeTimelineEntry>();
    public DbSet<PropertyCourtAccess> PropertyCourtAccesses => Set<PropertyCourtAccess>();
    public DbSet<OperationsTask> OperationsTasks => Set<OperationsTask>();
    public DbSet<OperationsTaskSequence> OperationsTaskSequences => Set<OperationsTaskSequence>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyOperationsModel();
}
