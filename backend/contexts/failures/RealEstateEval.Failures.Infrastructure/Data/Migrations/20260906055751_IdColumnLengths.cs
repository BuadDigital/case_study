using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts.Failures.Migrations
{
    /// <inheritdoc />
    public partial class IdColumnLengths : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "SuspendedByUserId",
                schema: "failures",
                table: "PropertyFailures",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "SuspendedByUserId",
                schema: "failures",
                table: "PropertyFailures",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);
        }
    }
}
