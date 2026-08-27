using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816130000_AddValuationComparableSelections")]
public partial class AddValuationComparableSelections : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ValuationComparableSelections",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                ComparablePropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                IsAdopted = table.Column<bool>(type: "boolean", nullable: false),
                SelectedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                SelectedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationComparableSelections", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationComparableSelections_ValuationRequests_ValuationRequestId",
                    column: x => x.ValuationRequestId,
                    principalSchema: "valuation",
                    principalTable: "ValuationRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_ValuationComparableSelections_ComparableProperties_ComparablePropertyId",
                    column: x => x.ComparablePropertyId,
                    principalSchema: "valuation",
                    principalTable: "ComparableProperties",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationComparableSelections_Request_Comp",
            schema: "valuation",
            table: "ValuationComparableSelections",
            columns: new[] { "ValuationRequestId", "ComparablePropertyId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ValuationComparableSelections_ValuationRequestId",
            schema: "valuation",
            table: "ValuationComparableSelections",
            column: "ValuationRequestId");

        migrationBuilder.CreateIndex(
            name: "IX_ValuationComparableSelections_ComparablePropertyId",
            schema: "valuation",
            table: "ValuationComparableSelections",
            column: "ComparablePropertyId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ValuationComparableSelections",
            schema: "valuation");
    }
}
