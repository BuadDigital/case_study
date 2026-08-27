using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations;

[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260816130000_AddOwnersAndOwnershipType")]
public partial class AddOwnersAndOwnershipType : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DeedOwnersJson",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(4000)",
            maxLength: 4000,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "OwnershipType",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "OwnershipTypeIsManual",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "boolean",
            nullable: false,
            defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "DeedOwnersJson",
            schema: "case_study",
            table: "WorkOrderProperties");

        migrationBuilder.DropColumn(
            name: "OwnershipType",
            schema: "case_study",
            table: "WorkOrderProperties");

        migrationBuilder.DropColumn(
            name: "OwnershipTypeIsManual",
            schema: "case_study",
            table: "WorkOrderProperties");
    }
}
