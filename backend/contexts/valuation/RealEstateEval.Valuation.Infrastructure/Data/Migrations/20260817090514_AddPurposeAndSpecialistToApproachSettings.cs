using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddPurposeAndSpecialistToApproachSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalSpecialistDetails",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ExternalSpecialistUsed",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ValuationPurposeKey",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ValuationPurposeNote",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalSpecialistDetails",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "ExternalSpecialistUsed",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "ValuationPurposeKey",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "ValuationPurposeNote",
                schema: "valuation",
                table: "ValuationApproachSettings");
        }
    }
}
