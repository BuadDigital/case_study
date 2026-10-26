using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ValuationApartmentBuildingPlot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BuildingPlotAreaSqm",
                schema: "valuation",
                table: "ValuationCostApproaches",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_BuildingPlotAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"BuildingPlotAreaSqm\" IS NULL OR \"BuildingPlotAreaSqm\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_BuildingPlotAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropColumn(
                name: "BuildingPlotAreaSqm",
                schema: "valuation",
                table: "ValuationCostApproaches");
        }
    }
}
