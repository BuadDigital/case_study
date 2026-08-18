using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Financial.Migrations;

/// <summary>
/// Empty financial baseline assumed the shared database already had financial tables and D1 inspector-fee rows in case_study. A dedicated financial database has no legacy stream, so this creates those tables (and the mapped audit.AuditLogs table) when they are missing.
/// </summary>
[DbContext(typeof(FinancialDbContext))]
[Migration("20260803061639_EnsureFinancialTablesForStandalone")]
public class EnsureFinancialTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS case_study;
            CREATE SCHEMA IF NOT EXISTS financial;

            CREATE TABLE IF NOT EXISTS financial."CourtVisitFeeCharges"
            (
                "Id" uuid NOT NULL,
                "AmountSar" numeric(12,2) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreditAssigneeId" character varying(128) NOT NULL,
                "CreditAssigneeName" character varying(256) NOT NULL,
                "OperationsTaskId" uuid NOT NULL,
                "PoNumber" character varying(64) NULL,
                "PricingTableId" uuid NULL,
                "Status" character varying(32) NOT NULL,
                "TaskDisplayId" character varying(32) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_CourtVisitFeeCharges" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_CourtVisitFeeCharges_CreditAssigneeId"
                ON financial."CourtVisitFeeCharges" ("CreditAssigneeId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CourtVisitFeeCharges_OperationsTaskId"
                ON financial."CourtVisitFeeCharges" ("OperationsTaskId");
            CREATE INDEX IF NOT EXISTS "IX_CourtVisitFeeCharges_PricingTableId"
                ON financial."CourtVisitFeeCharges" ("PricingTableId");
            CREATE INDEX IF NOT EXISTS "IX_CourtVisitFeeCharges_Status"
                ON financial."CourtVisitFeeCharges" ("Status");

            CREATE TABLE IF NOT EXISTS case_study."DisbursementBatches"
            (
                "Id" uuid NOT NULL,
                "AssigneeId" character varying(128) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "TotalNetSar" numeric(14,2) NOT NULL,
                CONSTRAINT "PK_DisbursementBatches" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_DisbursementBatches_AssigneeId"
                ON case_study."DisbursementBatches" ("AssigneeId");
            CREATE INDEX IF NOT EXISTS "IX_DisbursementBatches_CreatedAtUtc"
                ON case_study."DisbursementBatches" ("CreatedAtUtc");

            CREATE TABLE IF NOT EXISTS financial."DiscountFlags"
            (
                "Id" uuid NOT NULL,
                "ApprovedByUserId" character varying(450) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "FlaggedByUserId" character varying(450) NOT NULL,
                "ProposedDiscountSar" numeric(12,2) NOT NULL,
                "Reason" character varying(2000) NOT NULL,
                "ResolutionNote" character varying(2000) NULL,
                "ResolvedAtUtc" timestamp with time zone NULL,
                "Status" character varying(32) NOT NULL,
                "TargetAssigneeId" character varying(128) NOT NULL,
                "TransactionKey" character varying(64) NOT NULL,
                "WorkflowTaskId" uuid NULL,
                CONSTRAINT "PK_DiscountFlags" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_DiscountFlags_Status"
                ON financial."DiscountFlags" ("Status");
            CREATE INDEX IF NOT EXISTS "IX_DiscountFlags_TransactionKey"
                ON financial."DiscountFlags" ("TransactionKey");
            CREATE INDEX IF NOT EXISTS "IX_DiscountFlags_TransactionKey_TargetAssigneeId_Status"
                ON financial."DiscountFlags" ("TransactionKey", "TargetAssigneeId", "Status");

            CREATE TABLE IF NOT EXISTS financial."FinancialReportConfigs"
            (
                "Id" uuid NOT NULL,
                "ReportJson" jsonb NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_FinancialReportConfigs" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS financial."IncentiveSuspensions"
            (
                "Id" uuid NOT NULL,
                "AssigneeId" character varying(128) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "LiftedAtUtc" timestamp with time zone NULL,
                "LiftedByUserId" character varying(450) NULL,
                "PeriodFrom" date NULL,
                "PeriodTo" date NULL,
                "Reason" character varying(2000) NOT NULL,
                "TransactionKey" character varying(64) NOT NULL,
                "UserId" character varying(450) NOT NULL,
                CONSTRAINT "PK_IncentiveSuspensions" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_IncentiveSuspensions_ActiveAssigneeTransaction"
                ON financial."IncentiveSuspensions" ("AssigneeId", "TransactionKey") WHERE "LiftedAtUtc" IS NULL;

            CREATE TABLE IF NOT EXISTS case_study."InspectorFeeLedgers"
            (
                "Id" uuid NOT NULL,
                "AccruedAtUtc" timestamp with time zone NULL,
                "AgreedFeeSar" numeric(12,2) NOT NULL,
                "AssigneeId" character varying(128) NULL,
                "BillingStatus" character varying(32) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DeedId" uuid NOT NULL,
                "DisbursementBatchId" uuid NULL,
                "DisbursementVoucher" character varying(128) NULL,
                "DiscountReason" character varying(2000) NULL,
                "ExcludedFromBatch" boolean NOT NULL,
                "ExclusionReason" character varying(2000) NULL,
                "InspectorType" character varying(32) NOT NULL,
                "NetFeeSar" numeric(12,2) NOT NULL,
                "PaidAmountSar" numeric(12,2) NOT NULL,
                "PartyBillingStatementId" uuid NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PreSuspensionStatus" character varying(32) NULL,
                "PricingTableId" uuid NULL,
                "PropertyId" uuid NULL,
                "PropertyOrdinal" integer NOT NULL,
                "ReturnTo" character varying(32) NULL,
                "SupervisingDepartment" character varying(32) NOT NULL,
                "SupervisorDiscountSar" numeric(12,2) NOT NULL,
                "SuspensionReason" character varying(2000) NULL,
                "TransactionId" uuid NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "UserId" character varying(128) NOT NULL,
                "WorkflowTaskId" uuid NOT NULL,
                CONSTRAINT "PK_InspectorFeeLedgers" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_AccruedAtUtc"
                ON case_study."InspectorFeeLedgers" ("AccruedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_AssigneeId"
                ON case_study."InspectorFeeLedgers" ("AssigneeId");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_BillingStatus"
                ON case_study."InspectorFeeLedgers" ("BillingStatus");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_DisbursementBatchId"
                ON case_study."InspectorFeeLedgers" ("DisbursementBatchId");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_ExcludedFromBatch"
                ON case_study."InspectorFeeLedgers" ("ExcludedFromBatch");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_PartyBillingStatementId"
                ON case_study."InspectorFeeLedgers" ("PartyBillingStatementId");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_PoNumber"
                ON case_study."InspectorFeeLedgers" ("PoNumber");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_PricingTableId"
                ON case_study."InspectorFeeLedgers" ("PricingTableId");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_SupervisingDepartment"
                ON case_study."InspectorFeeLedgers" ("SupervisingDepartment");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_WorkflowTaskId"
                ON case_study."InspectorFeeLedgers" ("WorkflowTaskId");
            CREATE UNIQUE INDEX IF NOT EXISTS "UX_InspectorFeeLedgers_Transaction_Deed_User"
                ON case_study."InspectorFeeLedgers" ("TransactionId", "DeedId", "UserId");

            CREATE TABLE IF NOT EXISTS case_study."InspectorFeeTransitions"
            (
                "Id" uuid NOT NULL,
                "ActorUserId" character varying(450) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "FromStatus" character varying(32) NOT NULL,
                "Reason" character varying(2000) NULL,
                "ToStatus" character varying(32) NOT NULL,
                "WorkflowTaskId" uuid NOT NULL,
                CONSTRAINT "PK_InspectorFeeTransitions" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeTransitions_CreatedAtUtc"
                ON case_study."InspectorFeeTransitions" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeTransitions_WorkflowTaskId"
                ON case_study."InspectorFeeTransitions" ("WorkflowTaskId");

            CREATE TABLE IF NOT EXISTS financial."KeyReceiptFeeCharges"
            (
                "Id" uuid NOT NULL,
                "AmountSar" numeric(12,2) NOT NULL,
                "CollectedAtUtc" timestamp with time zone NULL,
                "CollectionStatus" character varying(32) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedByName" character varying(256) NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "EnvelopeId" uuid NOT NULL,
                "InvoiceReference" character varying(128) NULL,
                "PhotoAttachmentId" uuid NULL,
                "ReceiptAttachmentId" uuid NULL,
                "RequestNumber" character varying(128) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_KeyReceiptFeeCharges" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_KeyReceiptFeeCharges_CollectionStatus"
                ON financial."KeyReceiptFeeCharges" ("CollectionStatus");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_KeyReceiptFeeCharges_EnvelopeId"
                ON financial."KeyReceiptFeeCharges" ("EnvelopeId");
            CREATE INDEX IF NOT EXISTS "IX_KeyReceiptFeeCharges_RequestNumber"
                ON financial."KeyReceiptFeeCharges" ("RequestNumber");

            CREATE TABLE IF NOT EXISTS financial."PartyBillingStatements"
            (
                "Id" uuid NOT NULL,
                "AssigneeId" character varying(128) NOT NULL,
                "ClosedAtUtc" timestamp with time zone NULL,
                "ClosedByUserId" character varying(450) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "ExternalInvoiceNumber" character varying(128) NULL,
                "IssuedAtUtc" timestamp with time zone NULL,
                "IssuedByUserId" character varying(450) NULL,
                "Notes" character varying(2000) NULL,
                "PaidAtUtc" timestamp with time zone NULL,
                "ReferenceNumber" character varying(32) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "TotalNetSar" numeric(14,2) NOT NULL,
                "TransferReceiptAttachmentId" uuid NULL,
                "TransferReceiptRef" character varying(256) NULL,
                CONSTRAINT "PK_PartyBillingStatements" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PartyBillingStatements_AssigneeId"
                ON financial."PartyBillingStatements" ("AssigneeId");
            CREATE INDEX IF NOT EXISTS "IX_PartyBillingStatements_CreatedAtUtc"
                ON financial."PartyBillingStatements" ("CreatedAtUtc");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyBillingStatements_ReferenceNumber"
                ON financial."PartyBillingStatements" ("ReferenceNumber");
            CREATE INDEX IF NOT EXISTS "IX_PartyBillingStatements_Status"
                ON financial."PartyBillingStatements" ("Status");

            CREATE TABLE IF NOT EXISTS financial."PartyBillingStatementLines"
            (
                "Id" uuid NOT NULL,
                "NetFeeSar" numeric(12,2) NOT NULL,
                "StatementId" uuid NOT NULL,
                "WorkflowTaskId" uuid NOT NULL,
                CONSTRAINT "PK_PartyBillingStatementLines" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PartyBillingStatementLines_StatementId"
                ON financial."PartyBillingStatementLines" ("StatementId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyBillingStatementLines_WorkflowTaskId"
                ON financial."PartyBillingStatementLines" ("WorkflowTaskId");

            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingAssignments"
            (
                "Id" uuid NOT NULL,
                "AssigneeId" character varying(128) NOT NULL,
                "Category" character varying(32) NOT NULL,
                "TableId" uuid NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PartyFeePricingAssignments" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PartyFeePricingAssignments_TableId"
                ON financial."PartyFeePricingAssignments" ("TableId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyFeePricingAssignments_Category_AssigneeId"
                ON financial."PartyFeePricingAssignments" ("Category", "AssigneeId");

            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingTables"
            (
                "Id" uuid NOT NULL,
                "Category" character varying(32) NOT NULL,
                "FieldInspectorIndividualFeeSar" numeric(12,2) NOT NULL,
                "FieldInspectorOrganizationFeeSar" numeric(12,2) NOT NULL,
                "FlatAmountSar" numeric(12,2) NOT NULL,
                "CourtVisitFeeSar" numeric(12,2) NOT NULL,
                "IsActive" boolean NOT NULL,
                "ManagedBy" character varying(32) NOT NULL,
                "Name" character varying(128) NOT NULL,
                "PricingKind" character varying(32) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PartyFeePricingTables" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyFeePricingTables_Category"
                ON financial."PartyFeePricingTables" ("Category") WHERE "IsActive" = true;
            CREATE INDEX IF NOT EXISTS "IX_PartyFeePricingTables_PricingKind"
                ON financial."PartyFeePricingTables" ("PricingKind");

            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingTiers"
            (
                "Id" uuid NOT NULL,
                "FeeSar" numeric(12,2) NOT NULL,
                "MaxAreaM2" numeric(12,2) NULL,
                "SortOrder" integer NOT NULL,
                "TableId" uuid NOT NULL,
                CONSTRAINT "PK_PartyFeePricingTiers" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PartyFeePricingTiers_TableId_SortOrder"
                ON financial."PartyFeePricingTiers" ("TableId", "SortOrder");

            CREATE TABLE IF NOT EXISTS financial."PoEnfazInvoices"
            (
                "PoNumber" character varying(64) NULL,
                "AttachmentIdsJson" jsonb NULL,
                "CollectedAmountSar" numeric(14,2) NOT NULL,
                "CollectedAtUtc" timestamp with time zone NULL,
                "InvoiceNumber" character varying(128) NOT NULL,
                "IssuedAtUtc" timestamp with time zone NOT NULL,
                "Status" character varying(32) NOT NULL,
                "SubtotalSar" numeric(14,2) NOT NULL,
                "TotalSar" numeric(14,2) NOT NULL,
                "VatSar" numeric(14,2) NOT NULL,
                CONSTRAINT "PK_PoEnfazInvoices" PRIMARY KEY ("PoNumber")
            );

            CREATE TABLE IF NOT EXISTS financial."PoEnfazRevenueLines"
            (
                "Id" uuid NOT NULL,
                "CaseStudyFeeSar" numeric(12,2) NOT NULL,
                "IncludedInBilling" boolean NOT NULL,
                "KeyEntitlementEnvelopeId" uuid NULL,
                "KeyFeeSar" numeric(12,2) NOT NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PropertyId" uuid NOT NULL,
                "SurveyFeeSar" numeric(12,2) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PoEnfazRevenueLines" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PoEnfazRevenueLines_KeyEntitlementEnvelopeId"
                ON financial."PoEnfazRevenueLines" ("KeyEntitlementEnvelopeId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PoEnfazRevenueLines_PoNumber_PropertyId"
                ON financial."PoEnfazRevenueLines" ("PoNumber", "PropertyId");

            CREATE SCHEMA IF NOT EXISTS audit;
            CREATE TABLE IF NOT EXISTS audit."AuditLogs"
            (
                "Id" uuid NOT NULL,
                "Action" character varying(128) NOT NULL,
                "ActorId" character varying(128) NOT NULL,
                "AfterJson" jsonb NOT NULL,
                "BeforeJson" jsonb NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "EntityId" character varying(128) NOT NULL,
                "EntityType" character varying(64) NOT NULL,
                CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_Action" ON audit."AuditLogs" ("Action");
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_ActorId" ON audit."AuditLogs" ("ActorId");
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_CreatedAtUtc" ON audit."AuditLogs" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_EntityType_EntityId"
                ON audit."AuditLogs" ("EntityType", "EntityId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database these objects still belong to the legacy stream.
    }
}
