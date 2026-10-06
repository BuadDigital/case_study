using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts.Failures.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyFreezeLift : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SurveyFreezeLiftReason",
                schema: "failures",
                table: "PropertyFailures",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SurveyFreezeLiftedAtUtc",
                schema: "failures",
                table: "PropertyFailures",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SurveyFreezeLiftedByUserId",
                schema: "failures",
                table: "PropertyFailures",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SurveyFreezeLiftReason",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.DropColumn(
                name: "SurveyFreezeLiftedAtUtc",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.DropColumn(
                name: "SurveyFreezeLiftedByUserId",
                schema: "failures",
                table: "PropertyFailures");
        }
    }
}
