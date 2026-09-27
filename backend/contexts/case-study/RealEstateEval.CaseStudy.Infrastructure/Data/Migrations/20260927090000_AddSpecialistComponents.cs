using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// «مكونات العقار» moves to the case specialist: a report text on the property and the
    /// direct-cost item fields on each inventory line (key, unit, built-up ratio, repeated floors).
    /// </summary>
    public partial class AddSpecialistComponents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SpecialistComponentsText",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(8000)",
                maxLength: 8000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ItemKey",
                schema: "case_study",
                table: "BuildingInventoryLines",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                schema: "case_study",
                table: "BuildingInventoryLines",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BuildRatioPct",
                schema: "case_study",
                table: "BuildingInventoryLines",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RepeatedFloorCount",
                schema: "case_study",
                table: "BuildingInventoryLines",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "SpecialistComponentsText", schema: "case_study", table: "WorkOrderProperties");
            migrationBuilder.DropColumn(name: "ItemKey", schema: "case_study", table: "BuildingInventoryLines");
            migrationBuilder.DropColumn(name: "Unit", schema: "case_study", table: "BuildingInventoryLines");
            migrationBuilder.DropColumn(name: "BuildRatioPct", schema: "case_study", table: "BuildingInventoryLines");
            migrationBuilder.DropColumn(name: "RepeatedFloorCount", schema: "case_study", table: "BuildingInventoryLines");
        }
    }
}
