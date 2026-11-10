using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SharedOwnershipFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSharedOwnership",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // The deeds the old rule called shared (more than one named owner) keep "shared" — only
            // new edits follow the staff's tick (Omar 2026-11-10).
            migrationBuilder.Sql("""
                UPDATE case_study."WorkOrderProperties" p
                SET "IsSharedOwnership" = true
                WHERE jsonb_typeof(p."DeedOwnersJson") = 'array'
                  AND (SELECT count(*)
                       FROM jsonb_array_elements(p."DeedOwnersJson") o
                       WHERE btrim(coalesce(o->>'name', o->>'Name', '')) <> '') > 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSharedOwnership",
                schema: "case_study",
                table: "WorkOrderProperties");
        }
    }
}
