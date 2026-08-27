using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// Empty valuation baseline assumed the shared database already had valuation tables and
/// the shared outbox. A dedicated valuation database has no legacy stream, so this creates
/// the baseline tables (and this producer's outbox) when they are missing.
/// Later valuation migrations create comparables / approaches on top of this.
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260730061152_EnsureValuationTablesForStandalone")]
public class EnsureValuationTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS valuation;
            CREATE SCHEMA IF NOT EXISTS messaging;

            CREATE SEQUENCE IF NOT EXISTS valuation."ValuationRequestDisplayId"
                AS integer
                START WITH 445
                INCREMENT BY 1
                NO MINVALUE
                NO MAXVALUE
                CACHE 1;

            CREATE TABLE IF NOT EXISTS valuation."ValuationRequests"
            (
                "Id" uuid NOT NULL,
                "Appraiser" character varying(256) NOT NULL,
                "Area" character varying(128) NOT NULL,
                "DisplayId" character varying(64) NOT NULL,
                "PropertyId" character varying(128) NOT NULL,
                "PropertyType" character varying(128) NOT NULL,
                "RequestDate" character varying(32) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_ValuationRequests" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ValuationRequests_DisplayId"
                ON valuation."ValuationRequests" ("DisplayId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ValuationRequests_PropertyId_Open"
                ON valuation."ValuationRequests" ("PropertyId")
                WHERE "Status" <> 'done';

            CREATE TABLE IF NOT EXISTS valuation."EvaluatorRecallRecords"
            (
                "Id" uuid NOT NULL,
                "PoNumber" character varying(64) NOT NULL,
                "PropertyId" character varying(128) NOT NULL,
                "Reason" character varying(4000) NOT NULL,
                "RequestedAtUtc" timestamp with time zone NOT NULL,
                "ResolvedAtUtc" timestamp with time zone NULL,
                "SpecialistNote" character varying(4000) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "TaskId" character varying(64) NOT NULL,
                CONSTRAINT "PK_EvaluatorRecallRecords" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_EvaluatorRecallRecords_Status"
                ON valuation."EvaluatorRecallRecords" ("Status");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_EvaluatorRecallRecords_TaskId"
                ON valuation."EvaluatorRecallRecords" ("TaskId");

            CREATE TABLE IF NOT EXISTS messaging."OutboxMessages"
            (
                "Id" uuid NOT NULL,
                "AttemptCount" integer NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DeadLetteredAtUtc" timestamp with time zone NULL,
                "Error" character varying(2000) NULL,
                "EventType" character varying(128) NOT NULL,
                "LockedBy" character varying(128) NULL,
                "LockedUntilUtc" timestamp with time zone NULL,
                "PayloadJson" jsonb NOT NULL,
                "ProcessedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "PK_OutboxMessages" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_CreatedAtUtc"
                ON messaging."OutboxMessages" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_ProcessedAtUtc"
                ON messaging."OutboxMessages" ("ProcessedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_Pending_CreatedAtUtc"
                ON messaging."OutboxMessages" ("CreatedAtUtc")
                WHERE "ProcessedAtUtc" IS NULL AND "DeadLetteredAtUtc" IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database these objects still belong to the legacy stream.
    }
}
