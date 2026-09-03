using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddValuationDateAndAssumptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "RetrospectiveDate",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RetrospectiveRationale",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SelectedAssumptionsJson",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ValuationDateMode",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RetrospectiveDate",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "RetrospectiveRationale",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "SelectedAssumptionsJson",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "ValuationDateMode",
                schema: "valuation",
                table: "ValuationApproachSettings");
        }
    }
}
