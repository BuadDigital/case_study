using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCaseStudyFormInfathFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InfathClosingNotes",
                schema: "case_study",
                table: "CaseStudyForms",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "InfathLinkedAssets",
                schema: "case_study",
                table: "CaseStudyForms",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "InfathLinkedAssetsNotes",
                schema: "case_study",
                table: "CaseStudyForms",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "InfathLinkedDeedNumbers",
                schema: "case_study",
                table: "CaseStudyForms",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "InfathOtherNotes",
                schema: "case_study",
                table: "CaseStudyForms",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InfathClosingNotes",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.DropColumn(
                name: "InfathLinkedAssets",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.DropColumn(
                name: "InfathLinkedAssetsNotes",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.DropColumn(
                name: "InfathLinkedDeedNumbers",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.DropColumn(
                name: "InfathOtherNotes",
                schema: "case_study",
                table: "CaseStudyForms");
        }
    }
}
