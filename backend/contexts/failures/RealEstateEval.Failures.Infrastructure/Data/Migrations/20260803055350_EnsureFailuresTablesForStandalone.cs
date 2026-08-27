using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Failures.Migrations;

/// <summary>
/// Empty failures baseline assumed the shared database already had failures tables.
/// A dedicated failures database has no legacy stream, so this creates the baseline
/// tables when they are missing.
/// </summary>
[DbContext(typeof(FailuresDbContext))]
[Migration("20260803055350_EnsureFailuresTablesForStandalone")]
public class EnsureFailuresTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS failures;

            CREATE TABLE IF NOT EXISTS failures."FailureTypesCatalogConfigs"
            (
                "Id" uuid NOT NULL,
                "CatalogJson" jsonb NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_FailureTypesCatalogConfigs" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS failures."PropertyFailures"
            (
                "Id" uuid NOT NULL,
                "ContinueInstructions" character varying(4000) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DeedNumber" character varying(128) NOT NULL,
                "FinalNote" character varying(4000) NOT NULL,
                "InternalNote" character varying(4000) NOT NULL,
                "PoNumber" character varying(64) NOT NULL,
                "ProblemTypeId" character varying(64) NOT NULL,
                "PropertyId" character varying(128) NOT NULL,
                "RaisedByRole" character varying(128) NOT NULL,
                "ResolutionReason" character varying(4000) NOT NULL,
                "Severity" character varying(32) NOT NULL,
                "Specialist" character varying(256) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "SuspendedAtUtc" timestamp with time zone NULL,
                "SuspendedByUserId" character varying(450) NULL,
                "Title" character varying(512) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PropertyFailures" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_PropertyFailures_PoNumber"
                ON failures."PropertyFailures" ("PoNumber");
            CREATE INDEX IF NOT EXISTS "IX_PropertyFailures_Status"
                ON failures."PropertyFailures" ("Status");
            CREATE INDEX IF NOT EXISTS "IX_PropertyFailures_PoNumber_PropertyId"
                ON failures."PropertyFailures" ("PoNumber", "PropertyId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database these tables still belong to the legacy stream.
    }
}
