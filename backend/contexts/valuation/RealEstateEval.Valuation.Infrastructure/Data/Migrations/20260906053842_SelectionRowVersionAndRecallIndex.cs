using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class SelectionRowVersionAndRecallIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EvaluatorRecallRecords_Status",
                schema: "valuation",
                table: "EvaluatorRecallRecords");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorRecallRecords_Status",
                schema: "valuation",
                table: "EvaluatorRecallRecords",
                column: "Status");
        }
    }
}
