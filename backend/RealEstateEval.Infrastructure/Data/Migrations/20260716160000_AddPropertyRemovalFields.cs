using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>Soft-delete fields on work-order properties (removal reason for PO list).</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260716160000_AddPropertyRemovalFields")]
public partial class AddPropertyRemovalFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "IsRemoved" boolean NOT NULL DEFAULT false;

            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "RemovalReason" character varying(500);

            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "RemovedAtUtc" timestamp with time zone;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."WorkOrderProperties"
                DROP COLUMN IF EXISTS "RemovedAtUtc";

            ALTER TABLE case_study."WorkOrderProperties"
                DROP COLUMN IF EXISTS "RemovalReason";

            ALTER TABLE case_study."WorkOrderProperties"
                DROP COLUMN IF EXISTS "IsRemoved";
            """);
    }
}
