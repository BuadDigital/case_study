using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816230000_AddCostLineItemCatalog")]
public partial class AddCostLineItemCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ItemKey",
            schema: "valuation",
            table: "ValuationCostLines",
            type: "character varying(64)",
            maxLength: 64,
            nullable: false,
            defaultValue: "custom");

        migrationBuilder.AddColumn<string>(
            name: "Unit",
            schema: "valuation",
            table: "ValuationCostLines",
            type: "character varying(16)",
            maxLength: 16,
            nullable: false,
            defaultValue: "sqm");

        migrationBuilder.AddColumn<decimal>(
            name: "BuildRatioPct",
            schema: "valuation",
            table: "ValuationCostLines",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "RepeatedFloorCount",
            schema: "valuation",
            table: "ValuationCostLines",
            type: "integer",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ItemKey", schema: "valuation", table: "ValuationCostLines");
        migrationBuilder.DropColumn(name: "Unit", schema: "valuation", table: "ValuationCostLines");
        migrationBuilder.DropColumn(name: "BuildRatioPct", schema: "valuation", table: "ValuationCostLines");
        migrationBuilder.DropColumn(name: "RepeatedFloorCount", schema: "valuation", table: "ValuationCostLines");
    }
}
