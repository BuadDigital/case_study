using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260826123000_AddComparableSelectionContext")]
public partial class AddComparableSelectionContext : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "SelectionContext",
            schema: "valuation",
            table: "ValuationComparableSelections",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "market");

        migrationBuilder.DropIndex(
            name: "IX_ValuationComparableSelections_Request_Comp",
            schema: "valuation",
            table: "ValuationComparableSelections");

        migrationBuilder.CreateIndex(
            name: "IX_ValuationComparableSelections_Request_Comp_Context",
            schema: "valuation",
            table: "ValuationComparableSelections",
            columns: new[] { "ValuationRequestId", "ComparablePropertyId", "SelectionContext" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_ValuationComparableSelections_Request_Comp_Context",
            schema: "valuation",
            table: "ValuationComparableSelections");

        migrationBuilder.CreateIndex(
            name: "IX_ValuationComparableSelections_Request_Comp",
            schema: "valuation",
            table: "ValuationComparableSelections",
            columns: new[] { "ValuationRequestId", "ComparablePropertyId" },
            unique: true);

        migrationBuilder.DropColumn(
            name: "SelectionContext",
            schema: "valuation",
            table: "ValuationComparableSelections");
    }
}
