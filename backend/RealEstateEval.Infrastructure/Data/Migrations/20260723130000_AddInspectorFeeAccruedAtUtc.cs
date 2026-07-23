using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Marks when an engineering-survey fee became payable (specialist acceptance).
/// Backfills existing billable rows so visibility stays intact.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723130000_AddInspectorFeeAccruedAtUtc")]
public partial class AddInspectorFeeAccruedAtUtc : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."InspectorFeeLedgers"
            ADD COLUMN IF NOT EXISTS "AccruedAtUtc" timestamp with time zone NULL;
            """);

        migrationBuilder.Sql(
            """
            UPDATE case_study."InspectorFeeLedgers"
            SET "AccruedAtUtc" = "CreatedAtUtc"
            WHERE "AccruedAtUtc" IS NULL
              AND "AgreedFeeSar" > 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."InspectorFeeLedgers"
            DROP COLUMN IF EXISTS "AccruedAtUtc";
            """);
    }
}
