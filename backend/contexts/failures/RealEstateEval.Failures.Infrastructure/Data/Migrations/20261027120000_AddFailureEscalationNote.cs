using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts.Failures.Migrations
{
    /// <inheritdoc />
    public partial class AddFailureEscalationNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EscalationNote",
                schema: "failures",
                table: "PropertyFailures",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EscalationNote",
                schema: "failures",
                table: "PropertyFailures");
        }
    }
}
