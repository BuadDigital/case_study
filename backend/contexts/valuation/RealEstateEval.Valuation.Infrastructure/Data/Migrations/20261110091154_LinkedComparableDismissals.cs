using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class LinkedComparableDismissals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationDismissedLinkedComparables",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComparablePropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DismissedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationDismissedLinkedComparables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ValuationDismissedLinkedComparables_ComparableProperties_Co~",
                        column: x => x.ComparablePropertyId,
                        principalSchema: "valuation",
                        principalTable: "ComparableProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ValuationDismissedLinkedComparables_ValuationRequests_Valua~",
                        column: x => x.ValuationRequestId,
                        principalSchema: "valuation",
                        principalTable: "ValuationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ValuationDismissedLinkedComparables_ComparablePropertyId",
                schema: "valuation",
                table: "ValuationDismissedLinkedComparables",
                column: "ComparablePropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationDismissedLinkedComparables_Request_Comp",
                schema: "valuation",
                table: "ValuationDismissedLinkedComparables",
                columns: new[] { "ValuationRequestId", "ComparablePropertyId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ValuationDismissedLinkedComparables",
                schema: "valuation");
        }
    }
}
