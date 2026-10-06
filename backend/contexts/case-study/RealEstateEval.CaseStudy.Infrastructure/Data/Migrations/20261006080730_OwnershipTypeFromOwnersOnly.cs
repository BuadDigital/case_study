using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// The ownership type is now only absolute (one owner) or shared (several), derived from the
    /// owners list and never stored: the manual override columns go, and the per-owner share is
    /// stripped from the stored owners JSON (the shares logic is retired).
    /// </summary>
    public partial class OwnershipTypeFromOwnersOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE case_study."WorkOrderProperties"
                SET "DeedOwnersJson" = (
                    SELECT jsonb_agg(owner - 'sharePct')
                    FROM jsonb_array_elements("DeedOwnersJson") AS owner)
                WHERE "DeedOwnersJson" IS NOT NULL
                  AND jsonb_typeof("DeedOwnersJson") = 'array'
                  AND jsonb_array_length("DeedOwnersJson") > 0;
                """);

            migrationBuilder.DropColumn(
                name: "OwnershipType",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "OwnershipTypeIsManual",
                schema: "case_study",
                table: "WorkOrderProperties");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnershipType",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OwnershipTypeIsManual",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
