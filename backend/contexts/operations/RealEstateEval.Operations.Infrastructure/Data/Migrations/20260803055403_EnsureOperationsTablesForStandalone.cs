using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations;

/// <summary>
/// Empty operations baseline assumed the shared database already had operations tables and D2 task rows in case_study. A dedicated operations database has no legacy stream, so this creates those tables when they are missing.
/// </summary>
[DbContext(typeof(OperationsDbContext))]
[Migration("20260803055403_EnsureOperationsTablesForStandalone")]
public class EnsureOperationsTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS case_study;
            CREATE SCHEMA IF NOT EXISTS operations;

            CREATE TABLE IF NOT EXISTS operations."KeyEnvelopes"
            (
                "Id" uuid NOT NULL,
                "Circuit" character varying(150) NOT NULL,
                "ContactPhones" character varying(1000) NULL,
                "Court" character varying(256) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedByName" character varying(256) NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "FeeAmountSar" numeric(12,2) NULL,
                "FeeGenerated" boolean NOT NULL,
                "KeysCountActual" integer NOT NULL,
                "KeysCountLabeled" integer NOT NULL,
                "Notes" character varying(4000) NULL,
                "OperationsTaskId" uuid NULL,
                "PhotoAttachmentId" uuid NULL,
                "ReceiptAttachmentId" uuid NULL,
                "ReceiveScenario" character varying(32) NOT NULL,
                "RequestNumber" character varying(128) NOT NULL,
                "RevenueEntitlementAtUtc" timestamp with time zone NULL,
                "Status" character varying(32) NOT NULL,
                "ThirdPartyLetterAttachmentId" uuid NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_KeyEnvelopes" PRIMARY KEY ("Id")
            );
            -- Leftover shared DBs already have KeyEnvelopes from KeyEnvelopeIntegration
            -- without this column; the later legacy dual-write was moved to the Operations
            -- stream, so CREATE TABLE IF NOT EXISTS is a no-op and the index below would fail.
            ALTER TABLE operations."KeyEnvelopes"
                ADD COLUMN IF NOT EXISTS "RevenueEntitlementAtUtc" timestamp with time zone;
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_CreatedAtUtc"
                ON operations."KeyEnvelopes" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_FeeGenerated"
                ON operations."KeyEnvelopes" ("FeeGenerated");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_OperationsTaskId"
                ON operations."KeyEnvelopes" ("OperationsTaskId");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_RequestNumber"
                ON operations."KeyEnvelopes" ("RequestNumber");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_RevenueEntitlementAtUtc"
                ON operations."KeyEnvelopes" ("RevenueEntitlementAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_Status"
                ON operations."KeyEnvelopes" ("Status");

            CREATE TABLE IF NOT EXISTS operations."KeyEnvelopeAssignments"
            (
                "Id" uuid NOT NULL,
                "ConfirmedAtUtc" timestamp with time zone NULL,
                "ConfirmedByName" character varying(256) NULL,
                "ConfirmedByUserId" character varying(450) NULL,
                "DeedNumber" character varying(128) NOT NULL,
                "EnvelopeId" uuid NOT NULL,
                "Notes" character varying(2000) NULL,
                "PropertyId" uuid NULL,
                "Status" character varying(32) NOT NULL,
                CONSTRAINT "PK_KeyEnvelopeAssignments" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopeAssignments_EnvelopeId"
                ON operations."KeyEnvelopeAssignments" ("EnvelopeId");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopeAssignments_EnvelopeId_DeedNumber"
                ON operations."KeyEnvelopeAssignments" ("EnvelopeId", "DeedNumber");

            CREATE TABLE IF NOT EXISTS operations."KeyEnvelopeHandoffs"
            (
                "Id" uuid NOT NULL,
                "ConfirmedAtUtc" timestamp with time zone NULL,
                "ConfirmedByName" character varying(256) NULL,
                "ConfirmedByUserId" character varying(450) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedByName" character varying(256) NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "EnvelopeId" uuid NOT NULL,
                "FromParty" character varying(256) NOT NULL,
                "Kind" character varying(32) NOT NULL,
                "LetterAttachmentId" uuid NULL,
                "LetterNumber" character varying(128) NULL,
                "Notes" character varying(2000) NULL,
                "Status" character varying(32) NOT NULL,
                "ToParty" character varying(256) NOT NULL,
                "ToUserId" character varying(450) NULL,
                CONSTRAINT "PK_KeyEnvelopeHandoffs" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopeHandoffs_EnvelopeId"
                ON operations."KeyEnvelopeHandoffs" ("EnvelopeId");
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopeHandoffs_Status"
                ON operations."KeyEnvelopeHandoffs" ("Status");

            CREATE TABLE IF NOT EXISTS operations."KeyEnvelopeTimelineEntries"
            (
                "Id" uuid NOT NULL,
                "ActorName" character varying(256) NOT NULL,
                "ActorUserId" character varying(450) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "EnvelopeId" uuid NOT NULL,
                "EventType" character varying(64) NOT NULL,
                "PayloadJson" text NULL,
                "Summary" character varying(1000) NOT NULL,
                CONSTRAINT "PK_KeyEnvelopeTimelineEntries" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopeTimelineEntries_EnvelopeId_CreatedAtUtc"
                ON operations."KeyEnvelopeTimelineEntries" ("EnvelopeId", "CreatedAtUtc");

            CREATE TABLE IF NOT EXISTS case_study."OperationsTasks"
            (
                "Id" uuid NOT NULL,
                "AgreedVisitFeeSar" numeric(12,2) NULL,
                "AssigneeId" character varying(128) NOT NULL,
                "AssigneeName" character varying(256) NOT NULL,
                "CancelReason" character varying(2000) NULL,
                "CommentsJson" jsonb NULL,
                "CourtVisitResultJson" jsonb NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CreatedBy" character varying(128) NOT NULL,
                "CreatedByName" character varying(256) NOT NULL,
                "CreditAssigneeId" character varying(128) NULL,
                "CreditAssigneeName" character varying(256) NULL,
                "DeedsJson" jsonb NULL,
                "Description" character varying(4000) NULL,
                "DisplayId" character varying(32) NOT NULL,
                "DueAtUtc" timestamp with time zone NOT NULL,
                "LetterRowsJson" jsonb NULL,
                "OriginalAssigneeId" character varying(128) NULL,
                "OriginalAssigneeName" character varying(256) NULL,
                "PauseOverLimitRemindedAtUtc" timestamp with time zone NULL,
                "PauseReason" character varying(2000) NULL,
                "PausedAtUtc" timestamp with time zone NULL,
                "PoNumber" character varying(64) NULL,
                "PrevStatus" character varying(32) NULL,
                "Priority" character varying(16) NOT NULL,
                "ReceiptConfirmedAtUtc" timestamp with time zone NULL,
                "Reference" character varying(64) NULL,
                "RemindersJson" jsonb NULL,
                "Scope" character varying(32) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "Title" character varying(500) NOT NULL,
                "Type" character varying(32) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "VisitFeePricingTableId" uuid NULL,
                CONSTRAINT "PK_OperationsTasks" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_OperationsTasks_AssigneeId"
                ON case_study."OperationsTasks" ("AssigneeId");
            CREATE INDEX IF NOT EXISTS "IX_OperationsTasks_CreatedBy"
                ON case_study."OperationsTasks" ("CreatedBy");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_OperationsTasks_DisplayId"
                ON case_study."OperationsTasks" ("DisplayId");
            CREATE INDEX IF NOT EXISTS "IX_OperationsTasks_DueAtUtc"
                ON case_study."OperationsTasks" ("DueAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_OperationsTasks_PoNumber"
                ON case_study."OperationsTasks" ("PoNumber");
            CREATE INDEX IF NOT EXISTS "IX_OperationsTasks_Status"
                ON case_study."OperationsTasks" ("Status");

            CREATE TABLE IF NOT EXISTS case_study."OperationsTaskSequences"
            (
                "Id" uuid NOT NULL,
                "NextSeq" integer NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "Year" integer NOT NULL,
                CONSTRAINT "PK_OperationsTaskSequences" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_OperationsTaskSequences_Year"
                ON case_study."OperationsTaskSequences" ("Year");

            CREATE TABLE IF NOT EXISTS operations."PropertyCourtAccesses"
            (
                "Id" uuid NOT NULL,
                "ContactPhones" character varying(1000) NULL,
                "DeedNumber" character varying(128) NOT NULL,
                "EnablingLetterAttachmentId" uuid NULL,
                "EvictionNoticeAttachmentId" uuid NULL,
                "HasEnablingLetter" boolean NOT NULL,
                "HasEvictionNotice" boolean NOT NULL,
                "Notes" character varying(4000) NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PropertyId" uuid NOT NULL,
                "RequestNumber" character varying(128) NOT NULL,
                "StudyHoldStatus" character varying(32) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "UpdatedByName" character varying(256) NOT NULL,
                "UpdatedByUserId" character varying(450) NOT NULL,
                CONSTRAINT "PK_PropertyCourtAccesses" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PropertyCourtAccesses_PropertyId"
                ON operations."PropertyCourtAccesses" ("PropertyId");
            CREATE INDEX IF NOT EXISTS "IX_PropertyCourtAccesses_RequestNumber"
                ON operations."PropertyCourtAccesses" ("RequestNumber");
            CREATE INDEX IF NOT EXISTS "IX_PropertyCourtAccesses_StudyHoldStatus"
                ON operations."PropertyCourtAccesses" ("StudyHoldStatus");

            CREATE TABLE IF NOT EXISTS operations."PropertyKeyRecords"
            (
                "Id" uuid NOT NULL,
                "Area" character varying(128) NOT NULL,
                "HasKey" boolean NOT NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PropertyId" character varying(128) NOT NULL,
                "PropertyType" character varying(128) NOT NULL,
                "Specialist" character varying(256) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "WorkflowStatus" character varying(32) NOT NULL,
                CONSTRAINT "PK_PropertyKeyRecords" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PropertyKeyRecords_PoNumber_PropertyId"
                ON operations."PropertyKeyRecords" ("PoNumber", "PropertyId");

            CREATE TABLE IF NOT EXISTS operations."SurveyOffices"
            (
                "Id" uuid NOT NULL,
                "ActiveCount" integer NOT NULL,
                "AvgDaysLabel" character varying(64) NOT NULL,
                "ContractLabel" character varying(128) NOT NULL,
                "DoneMonth" integer NOT NULL,
                "Name" character varying(256) NOT NULL,
                "SortOrder" integer NOT NULL,
                "StatusBusy" boolean NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_SurveyOffices" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_SurveyOffices_SortOrder"
                ON operations."SurveyOffices" ("SortOrder");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database these objects still belong to the legacy stream.
    }
}
