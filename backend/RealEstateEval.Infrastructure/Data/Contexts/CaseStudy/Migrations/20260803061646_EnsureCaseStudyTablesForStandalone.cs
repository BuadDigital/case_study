using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>
/// Empty case-study baseline assumed the shared database already had case_study owner tables. A dedicated case-study database has no legacy stream, so this creates the baseline tables when they are missing. Later case-study migrations create clients, inventory, and property groups on top of this.
/// </summary>
[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260803061646_EnsureCaseStudyTablesForStandalone")]
public class EnsureCaseStudyTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS case_study;

            CREATE TABLE IF NOT EXISTS case_study."CaseStudyForms"
            (
                "Id" uuid NOT NULL,
                "AnswerProvenanceJson" jsonb NULL,
                "AnswersJson" jsonb NOT NULL,
                "ComponentsRemarks" character varying(4000) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "CurrentStep" integer NOT NULL,
                "DeedNumber" character varying(128) NOT NULL,
                "DeedRemarks" character varying(4000) NOT NULL,
                "HoaFee" character varying(64) NOT NULL,
                "InfathClosingNotes" character varying(4000) NOT NULL,
                "InfathLinkedAssets" character varying(8) NOT NULL,
                "InfathLinkedAssetsNotes" character varying(4000) NOT NULL,
                "InfathLinkedDeedNumbers" character varying(512) NOT NULL,
                "InfathOtherNotes" character varying(4000) NOT NULL,
                "IsPartyForm" boolean NOT NULL,
                "MeterNumber" character varying(128) NOT NULL,
                "MeterType" character varying(32) NOT NULL,
                "OccupancyRemarks" character varying(4000) NOT NULL,
                "PoNumber" character varying(64) NULL,
                "PropertyId" uuid NULL,
                "RequestDate" character varying(32) NOT NULL,
                "RequestNumber" character varying(128) NOT NULL,
                "SavedAtUtc" timestamp with time zone NULL,
                "SigApprover" character varying(256) NOT NULL,
                "SigDate" character varying(32) NOT NULL,
                "SigDeed" character varying(256) NOT NULL,
                "SpecialistReviewApprovedJson" jsonb NULL,
                "Status" character varying(32) NOT NULL,
                "SurveyRemarks" character varying(4000) NOT NULL,
                "TaskId" uuid NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_CaseStudyForms" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CaseStudyForms_TaskId_IsPartyForm"
                ON case_study."CaseStudyForms" ("TaskId", "IsPartyForm");

            CREATE TABLE IF NOT EXISTS case_study."DocumentReferenceCounters"
            (
                "Id" uuid NOT NULL,
                "DateKey" character varying(8) NOT NULL,
                "Dept" character varying(8) NOT NULL,
                "Seq" integer NOT NULL,
                "Type" character varying(8) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_DocumentReferenceCounters" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_DocumentReferenceCounters_Dept_Type_DateKey"
                ON case_study."DocumentReferenceCounters" ("Dept", "Type", "DateKey");

            CREATE TABLE IF NOT EXISTS case_study."FieldInspectionWorkspaces"
            (
                "WorkflowTaskId" uuid NOT NULL,
                "AttachmentCount" integer NOT NULL,
                "CompletedPhotoSlots" integer NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "InspectionConfirmed" boolean NOT NULL,
                "InspectionDate" date NULL,
                "InspectionTime" character varying(16) NULL,
                "MapLatitude" numeric(10,6) NULL,
                "MapLongitude" numeric(10,6) NULL,
                "ObservationCount" integer NOT NULL,
                "PartyTaskSubmissionId" uuid NOT NULL,
                "PendingPhotoApprovals" integer NOT NULL,
                "PoNumber" character varying(64) NULL,
                "PropertyId" uuid NULL,
                "RequiredPhotoSlots" integer NOT NULL,
                "Status" character varying(32) NOT NULL,
                "SubmittedAtUtc" timestamp with time zone NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_FieldInspectionWorkspaces" PRIMARY KEY ("WorkflowTaskId")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_FieldInspectionWorkspaces_PartyTaskSubmissionId"
                ON case_study."FieldInspectionWorkspaces" ("PartyTaskSubmissionId");
            CREATE INDEX IF NOT EXISTS "IX_FieldInspectionWorkspaces_PoNumber"
                ON case_study."FieldInspectionWorkspaces" ("PoNumber");
            CREATE INDEX IF NOT EXISTS "IX_FieldInspectionWorkspaces_PropertyId"
                ON case_study."FieldInspectionWorkspaces" ("PropertyId");
            CREATE INDEX IF NOT EXISTS "IX_FieldInspectionWorkspaces_Status"
                ON case_study."FieldInspectionWorkspaces" ("Status");

            CREATE TABLE IF NOT EXISTS case_study."InternalDelegationLetterSets"
            (
                "Id" uuid NOT NULL,
                "LettersJson" jsonb NOT NULL,
                "ScopeKey" character varying(128) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_InternalDelegationLetterSets" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_InternalDelegationLetterSets_ScopeKey"
                ON case_study."InternalDelegationLetterSets" ("ScopeKey");

            CREATE TABLE IF NOT EXISTS case_study."PartyTaskSubmissions"
            (
                "Id" uuid NOT NULL,
                "AcceptedAtUtc" timestamp with time zone NULL,
                "AcceptedByName" character varying(256) NULL,
                "AcceptedByUserId" character varying(450) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "Kind" character varying(64) NOT NULL,
                "PayloadJson" jsonb NOT NULL,
                "PoNumber" character varying(64) NULL,
                "PropertyId" uuid NULL,
                "ReopenedByName" character varying(256) NULL,
                "ReopenedByUserId" character varying(450) NULL,
                "ReturnNote" character varying(4000) NULL,
                "Status" character varying(32) NOT NULL,
                "SubmittedAtUtc" timestamp with time zone NULL,
                "SubmittedByName" character varying(256) NULL,
                "SubmittedByUserId" character varying(450) NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "WorkflowTaskId" uuid NOT NULL,
                CONSTRAINT "PK_PartyTaskSubmissions" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PartyTaskSubmissions_PoNumber"
                ON case_study."PartyTaskSubmissions" ("PoNumber");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyTaskSubmissions_WorkflowTaskId"
                ON case_study."PartyTaskSubmissions" ("WorkflowTaskId");

            CREATE TABLE IF NOT EXISTS case_study."PoIntakeDrafts"
            (
                "Id" uuid NOT NULL,
                "DraftJson" jsonb NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                "UserId" character varying(450) NOT NULL,
                CONSTRAINT "PK_PoIntakeDrafts" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PoIntakeDrafts_UserId"
                ON case_study."PoIntakeDrafts" ("UserId");

            CREATE TABLE IF NOT EXISTS case_study."PropertyContacts"
            (
                "Id" uuid NOT NULL,
                "Name" character varying(256) NOT NULL,
                "Phone" character varying(32) NOT NULL,
                "PropertyId" uuid NOT NULL,
                "Role" character varying(128) NOT NULL,
                "SortOrder" integer NOT NULL,
                CONSTRAINT "PK_PropertyContacts" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PropertyContacts_PropertyId"
                ON case_study."PropertyContacts" ("PropertyId");

            CREATE TABLE IF NOT EXISTS case_study."PropertyTimelineEntries"
            (
                "Id" uuid NOT NULL,
                "Detail" character varying(2000) NULL,
                "EventKey" character varying(128) NOT NULL,
                "OccurredAtUtc" timestamp with time zone NOT NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PropertyId" uuid NOT NULL,
                "RecordedAtUtc" timestamp with time zone NOT NULL,
                "Title" character varying(256) NOT NULL,
                "Tone" character varying(16) NOT NULL,
                CONSTRAINT "PK_PropertyTimelineEntries" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PropertyTimelineEntries_PoNumber_PropertyId_EventKey"
                ON case_study."PropertyTimelineEntries" ("PoNumber", "PropertyId", "EventKey");
            CREATE INDEX IF NOT EXISTS "IX_PropertyTimelineEntries_PoNumber_PropertyId_OccurredAtUtc"
                ON case_study."PropertyTimelineEntries" ("PoNumber", "PropertyId", "OccurredAtUtc");

            CREATE TABLE IF NOT EXISTS case_study."WorkOrders"
            (
                "Id" uuid NOT NULL,
                "AssignmentSpecialist" character varying(256) NULL,
                "AssignmentSpecialistEmail" character varying(256) NULL,
                "AssignmentType" integer NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DueDateAt" date NOT NULL,
                "ExpectedPropertyCount" integer NOT NULL,
                "LifecycleStatus" character varying(32) NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PromulgationDate" date NOT NULL,
                "PropertiesRegion" character varying(256) NULL,
                "ReceivedFromEnfathAt" date NOT NULL,
                "ReceivedFromEnfathTime" character varying(8) NULL,
                "WorkOrderDescription" character varying(2000) NULL,
                CONSTRAINT "PK_WorkOrders" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_WorkOrders_CreatedAtUtc"
                ON case_study."WorkOrders" ("CreatedAtUtc");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_WorkOrders_PoNumber"
                ON case_study."WorkOrders" ("PoNumber");

            CREATE TABLE IF NOT EXISTS case_study."WorkOrderProperties"
            (
                "Id" uuid NOT NULL,
                "Area" text NULL,
                "AssignmentDocFileName" text NULL,
                "AssignmentMandateDate" character varying(32) NULL,
                "AssignmentMandateNumber" character varying(64) NULL,
                "BoundariesAvailability" character varying(32) NULL,
                "BoundariesExternalDocName" character varying(512) NULL,
                "BourseCompletedAtUtc" timestamp with time zone NULL,
                "BourseDataCompleted" boolean NOT NULL,
                "Circuit" text NULL,
                "CircuitId" uuid NULL,
                "City" character varying(128) NOT NULL,
                "CityId" uuid NULL,
                "Classification" character varying(128) NOT NULL,
                "Court" text NULL,
                "CourtId" uuid NULL,
                "DeedDate" text NULL,
                "DeedNumber" character varying(128) NOT NULL,
                "DeedStatus" text NULL,
                "DelegationLetterFileName" character varying(2000) NULL,
                "District" character varying(128) NOT NULL,
                "EastBoundary" character varying(512) NULL,
                "EastBoundaryLengthM" character varying(32) NULL,
                "HasRequestNumber" boolean NOT NULL,
                "IdentifierType" integer NOT NULL,
                "IsRemoved" boolean NOT NULL,
                "LocationMapUrl" character varying(1024) NULL,
                "NorthBoundary" character varying(512) NULL,
                "NorthBoundaryLengthM" character varying(32) NULL,
                "OtherDocumentFileNames" character varying(2000) NULL,
                "OwnerName" text NULL,
                "PlanNumber" character varying(128) NULL,
                "PlotNumber" character varying(128) NULL,
                "PropertyType" character varying(128) NOT NULL,
                "RealEstateRegDate" character varying(32) NULL,
                "RealEstateRegFileName" text NULL,
                "RealEstateRegNumber" character varying(32) NULL,
                "Region" character varying(100) NULL,
                "RegionId" uuid NULL,
                "RemovalReason" character varying(500) NULL,
                "RemovedAtUtc" timestamp with time zone NULL,
                "RequestNumber" character varying(64) NULL,
                "RestrictionOtherReason" character varying(500) NULL,
                "RestrictionType" character varying(128) NULL,
                "RestrictionsPresent" character varying(8) NULL,
                "SouthBoundary" character varying(512) NULL,
                "SouthBoundaryLengthM" character varying(32) NULL,
                "WestBoundary" character varying(512) NULL,
                "WestBoundaryLengthM" character varying(32) NULL,
                "WorkOrderId" uuid NOT NULL,
                CONSTRAINT "PK_WorkOrderProperties" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_CircuitId"
                ON case_study."WorkOrderProperties" ("CircuitId");
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_CityId"
                ON case_study."WorkOrderProperties" ("CityId");
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_CourtId"
                ON case_study."WorkOrderProperties" ("CourtId");
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_DeedNumber"
                ON case_study."WorkOrderProperties" ("DeedNumber");
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_RegionId"
                ON case_study."WorkOrderProperties" ("RegionId");
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_RequestNumber"
                ON case_study."WorkOrderProperties" ("RequestNumber");
            CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_WorkOrderId_DeedNumber"
                ON case_study."WorkOrderProperties" ("WorkOrderId", "DeedNumber");

            CREATE TABLE IF NOT EXISTS case_study."WorkflowTasks"
            (
                "Id" uuid NOT NULL,
                "AssigneeId" character varying(64) NULL,
                "AssigneeName" character varying(256) NOT NULL,
                "AssigneeRole" character varying(64) NOT NULL,
                "AssignmentType" character varying(64) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DistributionJson" jsonb NULL,
                "Kind" character varying(64) NOT NULL,
                "ObstructionPriorPhase" character varying(32) NULL,
                "ObstructionReason" character varying(2000) NULL,
                "ParentTaskId" uuid NULL,
                "Phase" character varying(32) NOT NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PropertyId" uuid NULL,
                "PropertyOrdinal" integer NOT NULL,
                "Status" character varying(32) NOT NULL,
                "Title" character varying(512) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_WorkflowTasks" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_AssigneeId"
                ON case_study."WorkflowTasks" ("AssigneeId");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_CreatedAtUtc"
                ON case_study."WorkflowTasks" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_ParentTaskId"
                ON case_study."WorkflowTasks" ("ParentTaskId");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_PoNumber"
                ON case_study."WorkflowTasks" ("PoNumber");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_PropertyId"
                ON case_study."WorkflowTasks" ("PropertyId");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_Kind_Status"
                ON case_study."WorkflowTasks" ("Kind", "Status");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_PoNumber_PropertyId"
                ON case_study."WorkflowTasks" ("PoNumber", "PropertyId");
            CREATE INDEX IF NOT EXISTS "IX_WorkflowTasks_PoNumber_PropertyOrdinal"
                ON case_study."WorkflowTasks" ("PoNumber", "PropertyOrdinal");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database these objects still belong to the legacy stream.
    }
}
