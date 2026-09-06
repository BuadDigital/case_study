using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts.Failures.Migrations
{
    /// <inheritdoc />
    public partial class SuspendedFailuresPartialIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyFailures_Status",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyFailures_Suspended",
                schema: "failures",
                table: "PropertyFailures",
                column: "Status",
                filter: "\"Status\" = 'suspended'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyFailures_Suspended",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyFailures_Status",
                schema: "failures",
                table: "PropertyFailures",
                column: "Status");
        }
    }
}
