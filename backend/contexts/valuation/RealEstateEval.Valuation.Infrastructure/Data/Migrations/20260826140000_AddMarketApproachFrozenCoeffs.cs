using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260826140000_AddMarketApproachFrozenCoeffs")]
public partial class AddMarketApproachFrozenCoeffs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "AreaFactorPct",
            schema: "valuation",
            table: "ValuationMarketApproaches",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: false,
            defaultValue: 5m);

        migrationBuilder.AddColumn<decimal>(
            name: "AnnualMarketRatePct",
            schema: "valuation",
            table: "ValuationMarketApproaches",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: false,
            defaultValue: 4m);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "AreaFactorPct",
            schema: "valuation",
            table: "ValuationMarketApproaches");

        migrationBuilder.DropColumn(
            name: "AnnualMarketRatePct",
            schema: "valuation",
            table: "ValuationMarketApproaches");
    }
}
