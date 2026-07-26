using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Persists who suspended a failure and when. Backfills SuspendedAtUtc from
/// UpdatedAtUtc for already-suspended rows (suspend is terminal, so that
/// timestamp is accurate). SuspendedByUserId cannot be recovered historically.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260726110000_AddPropertyFailureSuspendAttribution")]
public partial class AddPropertyFailureSuspendAttribution : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE failures."PropertyFailures"
            ADD COLUMN IF NOT EXISTS "SuspendedAtUtc" timestamp with time zone NULL;

            ALTER TABLE failures."PropertyFailures"
            ADD COLUMN IF NOT EXISTS "SuspendedByUserId" character varying(450) NULL;
            """);

        migrationBuilder.Sql(
            """
            UPDATE failures."PropertyFailures"
            SET "SuspendedAtUtc" = "UpdatedAtUtc"
            WHERE "Status" = 'suspended'
              AND "SuspendedAtUtc" IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE failures."PropertyFailures"
            DROP COLUMN IF EXISTS "SuspendedAtUtc";

            ALTER TABLE failures."PropertyFailures"
            DROP COLUMN IF EXISTS "SuspendedByUserId";
            """);
    }
}
