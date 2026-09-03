using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816160000_AddValuationReconciliation")]
public partial class AddValuationReconciliation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ValuationReconciliations",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                MethodsRationale = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                FinalRoundDecimals = table.Column<int>(type: "integer", nullable: false),
                LiquidationDiscountPct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                LiquidationDiscountRationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationReconciliations", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationReconciliations_ValuationRequests_ValuationRequestId",
                    column: x => x.ValuationRequestId,
                    principalSchema: "valuation",
                    principalTable: "ValuationRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationReconciliations_ValuationRequestId",
            schema: "valuation",
            table: "ValuationReconciliations",
            column: "ValuationRequestId",
            unique: true);

        migrationBuilder.CreateTable(
            name: "ValuationReconciliationMethodLines",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ReconciliationId = table.Column<Guid>(type: "uuid", nullable: false),
                ApproachKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                ApproachValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                WeightPct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                Rationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                IsIncluded = table.Column<bool>(type: "boolean", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationReconciliationMethodLines", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationReconciliationMethodLines_ValuationReconciliations_ReconciliationId",
                    column: x => x.ReconciliationId,
                    principalSchema: "valuation",
                    principalTable: "ValuationReconciliations",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationReconciliationMethodLines_ReconciliationId",
            schema: "valuation",
            table: "ValuationReconciliationMethodLines",
            column: "ReconciliationId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ValuationReconciliationMethodLines",
            schema: "valuation");

        migrationBuilder.DropTable(
            name: "ValuationReconciliations",
            schema: "valuation");
    }
}
