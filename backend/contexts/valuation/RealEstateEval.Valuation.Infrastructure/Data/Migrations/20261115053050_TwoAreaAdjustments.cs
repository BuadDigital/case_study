using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// A built subject's two area lines (2026-11-15): the land a built comparable stands on (bank and
    /// per-valuation override), the subject's land area and the land line's own factor on the market
    /// header, and the header flag that switches the two lines on. Columns only: the flag is false on
    /// every header that exists, so a valuation already worked on or handed over keeps its figures.
    /// </summary>
    public partial class TwoAreaAdjustments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LandAreaFactorPct",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "numeric(9,4)",
                precision: 9,
                scale: 4,
                nullable: false,
                defaultValue: 5m);

            migrationBuilder.AddColumn<decimal>(
                name: "SubjectLandAreaSqm",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TwoAreaAdjustments",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "LandAreaOverrideSqm",
                schema: "valuation",
                table: "ValuationComparableSelections",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LandAreaSqm",
                schema: "valuation",
                table: "ComparableProperties",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationMarketApproaches_SubjectLandAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                sql: "\"SubjectLandAreaSqm\" IS NULL OR \"SubjectLandAreaSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationComparableSelections_LandAreaOverrideSqm_NonNegati~",
                schema: "valuation",
                table: "ValuationComparableSelections",
                sql: "\"LandAreaOverrideSqm\" IS NULL OR \"LandAreaOverrideSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ComparableProperties_LandAreaSqm_NonNegative",
                schema: "valuation",
                table: "ComparableProperties",
                sql: "\"LandAreaSqm\" IS NULL OR \"LandAreaSqm\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationMarketApproaches_SubjectLandAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationComparableSelections_LandAreaOverrideSqm_NonNegati~",
                schema: "valuation",
                table: "ValuationComparableSelections");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ComparableProperties_LandAreaSqm_NonNegative",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropColumn(
                name: "LandAreaFactorPct",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "SubjectLandAreaSqm",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "TwoAreaAdjustments",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "LandAreaOverrideSqm",
                schema: "valuation",
                table: "ValuationComparableSelections");

            migrationBuilder.DropColumn(
                name: "LandAreaSqm",
                schema: "valuation",
                table: "ComparableProperties");
        }
    }
}
