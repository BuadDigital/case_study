using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts;

/// <summary>
/// Financial-owned tables: the <c>financial</c> schema plus inspector-fee ledgers / transitions /
/// disbursement batches that still live in <c>case_study</c> physically (D1). Applied by
/// <see cref="FinancialDbContext"/> (write path) and by the legacy context for transitional
/// cross-boundary reads until owner APIs replace them.
/// </summary>
// A8: public — the owner context lives in its context library; this shared mapping stays
// global beside the frozen legacy context (drift guard).
public static class FinancialModel
{
    public static ModelBuilder ApplyFinancialModel(this ModelBuilder builder, bool ownsMigrations = true)
    {
        builder.Entity<PartyBillingStatement>(e =>
        {
            MapTable(e, "PartyBillingStatements", DatabaseSchemas.Financial, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.ReferenceNumber).HasMaxLength(32);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.PayeeType).HasMaxLength(32);
            e.Property(x => x.TaskKind).HasMaxLength(64);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.IssuedByUserId).HasMaxLength(450);
            e.Property(x => x.ClosedByUserId).HasMaxLength(450);
            e.Property(x => x.ExternalInvoiceNumber).HasMaxLength(128);
            e.Property(x => x.TransferReceiptRef).HasMaxLength(256);
            e.Property(x => x.TransferReference).HasMaxLength(256);
            e.Property(x => x.DisbursementVoucher).HasMaxLength(128);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.VendorInvoiceNumber).HasMaxLength(128);
            e.Property(x => x.VendorInvoiceSubmittedByUserId).HasMaxLength(450);
            e.Property(x => x.VendorInvoiceMatchedByUserId).HasMaxLength(450);
            e.Property(x => x.RejectedInvoicesJson).HasColumnType("jsonb");
            e.Property(x => x.CancelledByUserId).HasMaxLength(450);
            e.Property(x => x.CancelReason).HasMaxLength(1000);
            e.Property(x => x.TotalNetSar).HasPrecision(14, 2);
            e.HasIndex(x => x.ReferenceNumber).IsUnique();
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasIndex(x => x.DisbursementVoucher)
                .IsUnique()
                .HasFilter("\"DisbursementVoucher\" IS NOT NULL");
            e.HasMany(x => x.Lines)
                .WithOne(x => x.Statement!)
                .HasForeignKey(x => x.StatementId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PartyBillingStatementLine>(e =>
        {
            MapTable(e, "PartyBillingStatementLines", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.NetFeeSar).HasPrecision(12, 2);
            e.HasIndex(x => x.StatementId);
            e.HasIndex(x => x.WorkflowTaskId).IsUnique();
        });

        builder.Entity<PoEnfazRevenueLine>(e =>
        {
            MapTable(e, "PoEnfazRevenueLines", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.CaseStudyFeeSar).HasPrecision(12, 2);
            e.Property(x => x.SurveyFeeSar).HasPrecision(12, 2);
            e.Property(x => x.KeyFeeSar).HasPrecision(12, 2);
            e.Ignore(x => x.TotalFeeSar);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId }).IsUnique();
            e.HasIndex(x => x.KeyEntitlementEnvelopeId);
        });

        builder.Entity<PoEnfazInvoice>(e =>
        {
            MapTable(e, "PoEnfazInvoices", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.PoNumber);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.InvoiceNumber).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.SubtotalSar).HasPrecision(14, 2);
            e.Property(x => x.VatSar).HasPrecision(14, 2);
            e.Property(x => x.TotalSar).HasPrecision(14, 2);
            e.Property(x => x.CollectedAmountSar).HasPrecision(14, 2);
            e.Property(x => x.AttachmentIdsJson).HasColumnType("jsonb");
        });

        builder.Entity<PoEnfazFollowup>(e =>
        {
            MapTable(e, "PoEnfazFollowups", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.Channel).HasMaxLength(32);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => x.FollowedAtUtc);
        });

        builder.Entity<PoEnfazFinanceFlag>(e =>
        {
            MapTable(e, "PoEnfazFinanceFlags", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.Flag).HasMaxLength(32);
            e.Property(x => x.Note).HasMaxLength(1000);
            e.Property(x => x.SetByUserId).HasMaxLength(450);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId });
        });

        builder.Entity<KeyReceiptFeeCharge>(e =>
        {
            MapTable(e, "KeyReceiptFeeCharges", DatabaseSchemas.Financial, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.RequestNumber).HasMaxLength(128);
            e.Property(x => x.AmountSar).HasPrecision(12, 2);
            e.Property(x => x.CollectionStatus).HasMaxLength(32);
            e.Property(x => x.InvoiceReference).HasMaxLength(128);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.CreatedByName).HasMaxLength(256);
            e.HasIndex(x => x.EnvelopeId).IsUnique();
            e.HasIndex(x => x.RequestNumber);
            e.HasIndex(x => x.CollectionStatus);
        });

        builder.Entity<CourtVisitFeeCharge>(e =>
        {
            MapTable(e, "CourtVisitFeeCharges", DatabaseSchemas.Financial, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.TaskDisplayId).HasMaxLength(32);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.CreditAssigneeId).HasMaxLength(128);
            e.Property(x => x.CreditAssigneeName).HasMaxLength(256);
            e.Property(x => x.AmountSar).HasPrecision(12, 2);
            e.Property(x => x.Status).HasMaxLength(32);
            e.HasIndex(x => x.OperationsTaskId).IsUnique();
            e.HasIndex(x => x.CreditAssigneeId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.PricingTableId);
        });

        builder.Entity<FinancialReportConfig>(e =>
        {
            MapTable(e, "FinancialReportConfigs", DatabaseSchemas.Financial, ownsMigrations);
            e.Property(x => x.ReportJson).HasColumnType("jsonb");
        });

        builder.Entity<PartyFeePricingTable>(e =>
        {
            MapTable(e, "PartyFeePricingTables", DatabaseSchemas.Financial, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(128).IsRequired();
            e.Property(x => x.Category).HasMaxLength(32).IsRequired();
            e.Property(x => x.PricingKind).HasMaxLength(32).IsRequired();
            e.Property(x => x.ManagedBy).HasMaxLength(32).IsRequired();
            e.Property(x => x.CourtVisitFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorIndividualFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorOrganizationFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FlatAmountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.Category).IsUnique().HasFilter("\"IsActive\" = true");
            e.HasIndex(x => x.PricingKind);
            e.HasMany(x => x.AreaTiers).WithOne(x => x.Table).HasForeignKey(x => x.TableId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Assignments).WithOne(x => x.Table).HasForeignKey(x => x.TableId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PartyFeePricingTier>(e =>
        {
            MapTable(e, "PartyFeePricingTiers", DatabaseSchemas.Financial, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.MaxAreaM2).HasPrecision(12, 2);
            e.Property(x => x.FeeSar).HasPrecision(12, 2);
            e.HasIndex(x => new { x.TableId, x.SortOrder });
        });

        builder.Entity<PartyFeePricingAssignment>(e =>
        {
            MapTable(e, "PartyFeePricingAssignments", DatabaseSchemas.Financial, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.Category).HasMaxLength(32).IsRequired();
            e.Property(x => x.AssigneeId).HasMaxLength(128).IsRequired();
            e.HasIndex(x => new { x.Category, x.AssigneeId }).IsUnique();
            e.HasIndex(x => x.TableId);
        });

        builder.Entity<IncentiveSuspension>(e =>
        {
            MapTable(e, "IncentiveSuspensions", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.AssigneeId).HasMaxLength(128).IsRequired();
            e.Property(x => x.TransactionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.Property(x => x.CreatedByUserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.LiftedByUserId).HasMaxLength(450);
            e.HasIndex(x => new { x.AssigneeId, x.TransactionKey });
            e.HasIndex(x => new { x.AssigneeId, x.TransactionKey })
                .IsUnique()
                .HasFilter("\"LiftedAtUtc\" IS NULL")
                .HasDatabaseName("IX_IncentiveSuspensions_ActiveAssigneeTransaction");
        });

        builder.Entity<DiscountFlag>(e =>
        {
            MapTable(e, "DiscountFlags", DatabaseSchemas.Financial, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.TransactionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.TargetAssigneeId).HasMaxLength(128).IsRequired();
            e.Property(x => x.FlaggedByUserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.ApprovedByUserId).HasMaxLength(450);
            e.Property(x => x.ResolutionNote).HasMaxLength(2000);
            e.Property(x => x.ProposedDiscountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.TransactionKey);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => new { x.TransactionKey, x.TargetAssigneeId, x.Status });
        });

 // D1: accrual/disbursement lifecycle is financial-owned while rows stay in case_study.
        builder.Entity<InspectorFeeLedger>(e =>
        {
            MapTable(e, "InspectorFeeLedgers", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).HasMaxLength(128).IsRequired();
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.InspectorType).HasMaxLength(32);
            e.Property(x => x.SupervisingDepartment).HasMaxLength(32);
            e.Property(x => x.DiscountReason).HasMaxLength(2000);
            e.Property(x => x.BillingStatus).HasMaxLength(32);
            e.Property(x => x.PreSuspensionStatus).HasMaxLength(32);
            e.Property(x => x.SuspensionReason).HasMaxLength(2000);
            e.Property(x => x.ExclusionReason).HasMaxLength(2000);
            e.Property(x => x.ReturnTo).HasMaxLength(32);
            e.Property(x => x.DisbursementVoucher).HasMaxLength(128);
            e.Property(x => x.AgreedFeeSar).HasPrecision(12, 2);
            e.Property(x => x.SupervisorDiscountSar).HasPrecision(12, 2);
            e.Property(x => x.NetFeeSar).HasPrecision(12, 2);
            e.Property(x => x.PaidAmountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.WorkflowTaskId);
            e.HasIndex(x => new { x.TransactionId, x.DeedId, x.UserId })
                .IsUnique()
                .HasDatabaseName("UX_InspectorFeeLedgers_Transaction_Deed_User");
            e.HasIndex(x => x.AccruedAtUtc);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.SupervisingDepartment);
            e.HasIndex(x => x.BillingStatus);
            e.HasIndex(x => x.PricingTableId);
            e.HasIndex(x => x.ExcludedFromBatch);
            e.HasIndex(x => x.DisbursementBatchId);
            e.HasIndex(x => x.PartyBillingStatementId);
        });

        builder.Entity<InspectorFeeTransition>(e =>
        {
            MapTable(e, "InspectorFeeTransitions", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.FromStatus).HasMaxLength(32);
            e.Property(x => x.ToStatus).HasMaxLength(32);
            e.Property(x => x.Reason).HasMaxLength(2000);
            e.Property(x => x.ActorUserId).HasMaxLength(450);
            e.HasIndex(x => x.WorkflowTaskId);
            e.HasIndex(x => x.CreatedAtUtc);
        });

        builder.Entity<DisbursementBatch>(e =>
        {
            MapTable(e, "DisbursementBatches", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.HasKey(x => x.Id);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.TotalNetSar).HasPrecision(14, 2);
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.CreatedAtUtc);
        });

        return builder;
    }

    private static void MapTable<TEntity>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> e,
        string table,
        string schema,
        bool ownsMigrations)
        where TEntity : class
    {
        if (ownsMigrations)
            e.ToTable(table, schema);
        else
            e.ToTable(table, schema, t => t.ExcludeFromMigrations());
    }
}
