using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Makes specialist acceptance visible on the submission itself, instead of only
/// on the fee ledger. Backfills from the engineering-survey ledger's accrual time
/// so already-accepted work stays visible after the change.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260726100000_AddPartyTaskSubmissionAcceptedAtUtc")]
public partial class AddPartyTaskSubmissionAcceptedAtUtc : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."PartyTaskSubmissions"
            ADD COLUMN IF NOT EXISTS "AcceptedAtUtc" timestamp with time zone NULL;
            """);

        migrationBuilder.Sql(
            """
            UPDATE case_study."PartyTaskSubmissions" s
            SET "AcceptedAtUtc" = l."AccruedAtUtc"
            FROM case_study."InspectorFeeLedgers" l
            WHERE l."WorkflowTaskId" = s."WorkflowTaskId"
              AND s."Kind" = 'engineering-survey'
              AND s."AcceptedAtUtc" IS NULL
              AND l."AccruedAtUtc" IS NOT NULL
              AND l."AgreedFeeSar" > 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."PartyTaskSubmissions"
            DROP COLUMN IF EXISTS "AcceptedAtUtc";
            """);
    }
}
