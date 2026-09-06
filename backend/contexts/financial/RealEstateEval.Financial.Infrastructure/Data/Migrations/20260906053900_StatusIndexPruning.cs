using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    /// <inheritdoc />
    public partial class StatusIndexPruning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PartyBillingStatements_Status",
                schema: "financial",
                table: "PartyBillingStatements");

            migrationBuilder.DropIndex(
                name: "IX_KeyReceiptFeeCharges_CollectionStatus",
                schema: "financial",
                table: "KeyReceiptFeeCharges");

            migrationBuilder.DropIndex(
                name: "IX_CourtVisitFeeCharges_Status",
                schema: "financial",
                table: "CourtVisitFeeCharges");

            migrationBuilder.CreateIndex(
                name: "IX_CourtVisitFeeCharges_Open",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                column: "Status",
                filter: "\"Status\" = 'open'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CourtVisitFeeCharges_Open",
                schema: "financial",
                table: "CourtVisitFeeCharges");

            migrationBuilder.CreateIndex(
                name: "IX_PartyBillingStatements_Status",
                schema: "financial",
                table: "PartyBillingStatements",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_KeyReceiptFeeCharges_CollectionStatus",
                schema: "financial",
                table: "KeyReceiptFeeCharges",
                column: "CollectionStatus");

            migrationBuilder.CreateIndex(
                name: "IX_CourtVisitFeeCharges_Status",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                column: "Status");
        }
    }
}
