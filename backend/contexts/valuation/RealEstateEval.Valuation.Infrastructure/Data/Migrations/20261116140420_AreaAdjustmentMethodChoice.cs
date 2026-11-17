using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// The appraiser picks each area line's method (2026-11-16, curriculum 105): المضاعف / الأمثال, or a
    /// cash amount on the whole-property basis with its rate per m². Columns only and all null, so every
    /// header that exists keeps the table's automatic choice and its figures.
    /// </summary>
    public partial class AreaAdjustmentMethodChoice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AreaAdjustmentMethod",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AreaCashRateSar",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LandAreaAdjustmentMethod",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LandAreaCashRateSar",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationMarketApproaches_AreaCashRateSar_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                sql: "\"AreaCashRateSar\" IS NULL OR \"AreaCashRateSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationMarketApproaches_LandAreaCashRateSar_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                sql: "\"LandAreaCashRateSar\" IS NULL OR \"LandAreaCashRateSar\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationMarketApproaches_AreaCashRateSar_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationMarketApproaches_LandAreaCashRateSar_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "AreaAdjustmentMethod",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "AreaCashRateSar",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "LandAreaAdjustmentMethod",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropColumn(
                name: "LandAreaCashRateSar",
                schema: "valuation",
                table: "ValuationMarketApproaches");
        }
    }
}
