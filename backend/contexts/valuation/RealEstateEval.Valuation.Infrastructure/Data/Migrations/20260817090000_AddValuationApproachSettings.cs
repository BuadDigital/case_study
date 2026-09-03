using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260817090000_AddValuationApproachSettings")]
public partial class AddValuationApproachSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ValuationApproachSettings",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                MarketApproachEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                CostApproachEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                IncomeApproachEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                CostBasisKey = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "replacement"),
                CostMeasurementUnitKey = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "comparison_unit"),
                AdjustmentsEditUnlocked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationApproachSettings", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationApproachSettings_ValuationRequests_ValuationRequestId",
                    column: x => x.ValuationRequestId,
                    principalSchema: "valuation",
                    principalTable: "ValuationRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationApproachSettings_ValuationRequestId",
            schema: "valuation",
            table: "ValuationApproachSettings",
            column: "ValuationRequestId",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ValuationApproachSettings",
            schema: "valuation");
    }
}
