using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816150000_AddMarketAndCostApproach")]
public partial class AddMarketAndCostApproach : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ValuationMarketApproaches",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                SubjectAreaSqm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                AnalysisNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationMarketApproaches", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationMarketApproaches_ValuationRequests_ValuationRequestId",
                    column: x => x.ValuationRequestId,
                    principalSchema: "valuation",
                    principalTable: "ValuationRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationMarketApproaches_ValuationRequestId",
            schema: "valuation",
            table: "ValuationMarketApproaches",
            column: "ValuationRequestId",
            unique: true);

        migrationBuilder.CreateTable(
            name: "ValuationCostApproaches",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                LandValueFromMarket = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                LandImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                AnalysisNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationCostApproaches", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationCostApproaches_ValuationRequests_ValuationRequestId",
                    column: x => x.ValuationRequestId,
                    principalSchema: "valuation",
                    principalTable: "ValuationRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationCostApproaches_ValuationRequestId",
            schema: "valuation",
            table: "ValuationCostApproaches",
            column: "ValuationRequestId",
            unique: true);

        migrationBuilder.CreateTable(
            name: "ValuationCostLines",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CostApproachId = table.Column<Guid>(type: "uuid", nullable: false),
                SourceInventoryLineId = table.Column<Guid>(type: "uuid", nullable: true),
                StructureKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                Label = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                AreaSqm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                UnitCostSar = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                Rationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                IsIncluded = table.Column<bool>(type: "boolean", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationCostLines", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationCostLines_ValuationCostApproaches_CostApproachId",
                    column: x => x.CostApproachId,
                    principalSchema: "valuation",
                    principalTable: "ValuationCostApproaches",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationCostLines_CostApproachId",
            schema: "valuation",
            table: "ValuationCostLines",
            column: "CostApproachId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "ValuationCostLines", schema: "valuation");
        migrationBuilder.DropTable(name: "ValuationCostApproaches", schema: "valuation");
        migrationBuilder.DropTable(name: "ValuationMarketApproaches", schema: "valuation");
    }
}
