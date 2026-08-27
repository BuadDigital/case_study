using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260824180000_AddPartitionMinutes")]
public partial class AddPartitionMinutes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "PartitionMinutesNumber" character varying(128);
            ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "PartitionMinutesDate" character varying(32);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "PartitionMinutesNumber",
            schema: "case_study",
            table: "WorkOrderProperties");

        migrationBuilder.DropColumn(
            name: "PartitionMinutesDate",
            schema: "case_study",
            table: "WorkOrderProperties");
    }
}
