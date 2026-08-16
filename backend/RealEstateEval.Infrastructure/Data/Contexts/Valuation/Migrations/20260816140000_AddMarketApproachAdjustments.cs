using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816140000_AddMarketApproachAdjustments")]
public partial class AddMarketApproachAdjustments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "WeightPct",
            schema: "valuation",
            table: "ValuationComparableSelections",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "WeightIsManual",
            schema: "valuation",
            table: "ValuationComparableSelections",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateTable(
            name: "ValuationComparableAdjustmentLines",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                SelectionId = table.Column<Guid>(type: "uuid", nullable: false),
                FactorKey = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                LabelAr = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                Percent = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                Rationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                IsIncluded = table.Column<bool>(type: "boolean", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationComparableAdjustmentLines", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationComparableAdjustmentLines_ValuationComparableSelections_SelectionId",
                    column: x => x.SelectionId,
                    principalSchema: "valuation",
                    principalTable: "ValuationComparableSelections",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationComparableAdjustmentLines_SelectionId",
            schema: "valuation",
            table: "ValuationComparableAdjustmentLines",
            column: "SelectionId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ValuationComparableAdjustmentLines",
            schema: "valuation");

        migrationBuilder.DropColumn(
            name: "WeightPct",
            schema: "valuation",
            table: "ValuationComparableSelections");

        migrationBuilder.DropColumn(
            name: "WeightIsManual",
            schema: "valuation",
            table: "ValuationComparableSelections");
    }
}
