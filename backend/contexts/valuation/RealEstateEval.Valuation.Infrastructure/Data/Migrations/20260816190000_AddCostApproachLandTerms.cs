using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816190000_AddCostApproachLandTerms")]
public partial class AddCostApproachLandTerms : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "LandUnitRateFromMarket",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(18,2)",
            precision: 18,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "LandAreaSqm",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(18,2)",
            precision: 18,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "UseRestrictionDiscountPct",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<string>(
            name: "UseRestrictionRationale",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "ApartmentLandShareSqm",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(18,2)",
            precision: 18,
            scale: 2,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "LandUnitRateFromMarket",
            schema: "valuation",
            table: "ValuationCostApproaches");

        migrationBuilder.DropColumn(
            name: "LandAreaSqm",
            schema: "valuation",
            table: "ValuationCostApproaches");

        migrationBuilder.DropColumn(
            name: "UseRestrictionDiscountPct",
            schema: "valuation",
            table: "ValuationCostApproaches");

        migrationBuilder.DropColumn(
            name: "UseRestrictionRationale",
            schema: "valuation",
            table: "ValuationCostApproaches");

        migrationBuilder.DropColumn(
            name: "ApartmentLandShareSqm",
            schema: "valuation",
            table: "ValuationCostApproaches");
    }
}
