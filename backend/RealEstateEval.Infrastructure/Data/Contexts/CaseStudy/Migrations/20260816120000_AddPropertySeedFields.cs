using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>
/// Seed fields: plan name, block, boundary types, facades, finishing.
/// </summary>
[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260816120000_AddPropertySeedFields")]
public partial class AddPropertySeedFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PlanName",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(256)",
            maxLength: 256,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "BlockNumber",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "NorthBoundaryType",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SouthBoundaryType",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "EastBoundaryType",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "WestBoundaryType",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "NorthFacadeFinishing",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SouthFacadeFinishing",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "EastFacadeFinishing",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "WestFacadeFinishing",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "FinishingType",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "FinishingStructure",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PlanName", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "BlockNumber", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "NorthBoundaryType", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "SouthBoundaryType", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "EastBoundaryType", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "WestBoundaryType", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "NorthFacadeFinishing", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "SouthFacadeFinishing", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "EastFacadeFinishing", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "WestFacadeFinishing", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "FinishingType", schema: "case_study", table: "WorkOrderProperties");
        migrationBuilder.DropColumn(name: "FinishingStructure", schema: "case_study", table: "WorkOrderProperties");
    }
}
