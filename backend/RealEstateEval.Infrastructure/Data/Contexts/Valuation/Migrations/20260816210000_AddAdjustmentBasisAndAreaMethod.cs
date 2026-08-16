using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816210000_AddAdjustmentBasisAndAreaMethod")]
public partial class AddAdjustmentBasisAndAreaMethod : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "AdjustmentBasis",
            schema: "valuation",
            table: "ValuationMarketApproaches",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "price_per_sqm");

        migrationBuilder.AddColumn<string>(
            name: "AreaAdjustmentMethod",
            schema: "valuation",
            table: "ValuationComparableSelections",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "multiplier");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "AdjustmentBasis",
            schema: "valuation",
            table: "ValuationMarketApproaches");

        migrationBuilder.DropColumn(
            name: "AreaAdjustmentMethod",
            schema: "valuation",
            table: "ValuationComparableSelections");
    }
}
