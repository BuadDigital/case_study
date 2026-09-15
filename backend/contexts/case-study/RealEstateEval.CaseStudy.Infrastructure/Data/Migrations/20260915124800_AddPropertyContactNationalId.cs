using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    [DbContext(typeof(CaseStudyDbContext))]
    [Migration("20260915124800_AddPropertyContactNationalId")]
    public partial class AddPropertyContactNationalId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NationalId",
                schema: "case_study",
                table: "PropertyContacts",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NationalId",
                schema: "case_study",
                table: "PropertyContacts");
        }
    }
}
