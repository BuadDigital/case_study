using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    /// <inheritdoc />
    public partial class StatusIndexPruning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyCourtAccesses_StudyHoldStatus",
                schema: "operations",
                table: "PropertyCourtAccesses");

            migrationBuilder.DropIndex(
                name: "IX_KeyEnvelopes_Status",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropIndex(
                name: "IX_KeyEnvelopeHandoffs_Status",
                schema: "operations",
                table: "KeyEnvelopeHandoffs");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCourtAccesses_EnabledNoKey",
                schema: "operations",
                table: "PropertyCourtAccesses",
                column: "StudyHoldStatus",
                filter: "\"StudyHoldStatus\" = 'enabled_no_key'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyCourtAccesses_EnabledNoKey",
                schema: "operations",
                table: "PropertyCourtAccesses");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCourtAccesses_StudyHoldStatus",
                schema: "operations",
                table: "PropertyCourtAccesses",
                column: "StudyHoldStatus");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_Status",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopeHandoffs_Status",
                schema: "operations",
                table: "KeyEnvelopeHandoffs",
                column: "Status");
        }
    }
}
