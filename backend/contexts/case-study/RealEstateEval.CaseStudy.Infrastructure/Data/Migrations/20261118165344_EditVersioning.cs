using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class EditVersioning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ChangesValue",
                schema: "case_study",
                table: "TransactionReopenings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ValuationInputsJson",
                schema: "case_study",
                table: "TransactionReopenings",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReportVersion",
                schema: "case_study",
                table: "CaseStudyReports",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChangesValue",
                schema: "case_study",
                table: "TransactionReopenings");

            migrationBuilder.DropColumn(
                name: "ValuationInputsJson",
                schema: "case_study",
                table: "TransactionReopenings");

            migrationBuilder.DropColumn(
                name: "ReportVersion",
                schema: "case_study",
                table: "CaseStudyReports");
        }
    }
}
