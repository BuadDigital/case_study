using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations;

[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260907060000_AddWorkOrderValuationKeys")]
public partial class AddWorkOrderValuationKeys : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE case_study."WorkOrders"
                ADD COLUMN IF NOT EXISTS "ValuationPurposeKey" character varying(32);
            ALTER TABLE case_study."WorkOrders"
                ADD COLUMN IF NOT EXISTS "BasisOfValueKey" character varying(32);
            ALTER TABLE case_study."WorkOrders"
                ADD COLUMN IF NOT EXISTS "ValuePremiseKey" character varying(32);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ValuationPurposeKey",
            schema: "case_study",
            table: "WorkOrders");
        migrationBuilder.DropColumn(
            name: "BasisOfValueKey",
            schema: "case_study",
            table: "WorkOrders");
        migrationBuilder.DropColumn(
            name: "ValuePremiseKey",
            schema: "case_study",
            table: "WorkOrders");
    }
}
