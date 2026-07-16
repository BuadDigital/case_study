using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>نوع القيد + سبب «أخرى» لحقول قيود البورصة.</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260716180000_AddRestrictionTypeFields")]
public partial class AddRestrictionTypeFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "RestrictionType" character varying(32);

            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "RestrictionOtherReason" character varying(500);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."WorkOrderProperties"
                DROP COLUMN IF EXISTS "RestrictionOtherReason";

            ALTER TABLE case_study."WorkOrderProperties"
                DROP COLUMN IF EXISTS "RestrictionType";
            """);
    }
}
