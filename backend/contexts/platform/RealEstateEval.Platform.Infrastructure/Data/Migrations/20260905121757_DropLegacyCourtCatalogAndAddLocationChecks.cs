using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyCourtCatalogAndAddLocationChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourtCatalogEntries",
                schema: "platform");

            migrationBuilder.DropIndex(
                name: "IX_Regions_IsActive",
                schema: "platform",
                table: "Regions");

            migrationBuilder.DropIndex(
                name: "IX_Districts_IsActive",
                schema: "platform",
                table: "Districts");

            migrationBuilder.DropIndex(
                name: "IX_Courts_IsActive",
                schema: "platform",
                table: "Courts");

            migrationBuilder.DropIndex(
                name: "IX_CourtCircuits_IsActive",
                schema: "platform",
                table: "CourtCircuits");

            migrationBuilder.DropIndex(
                name: "IX_Cities_IsActive",
                schema: "platform",
                table: "Cities");

            // text -> jsonb needs an explicit cast; an empty package (none is expected) becomes {}.
            migrationBuilder.Sql(
                """
                ALTER TABLE platform."ValuationReportTextPackages"
                    ALTER COLUMN "TextsJson" TYPE jsonb
                    USING (CASE WHEN "TextsJson" = '' THEN '{}' ELSE "TextsJson" END)::jsonb;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Districts_Status",
                schema: "platform",
                table: "Districts",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('approved', 'pending', 'merged')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Cities_Status",
                schema: "platform",
                table: "Cities",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('approved', 'pending', 'merged')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Districts_Status",
                schema: "platform",
                table: "Districts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Cities_Status",
                schema: "platform",
                table: "Cities");

            migrationBuilder.Sql(
                """
                ALTER TABLE platform."ValuationReportTextPackages"
                    ALTER COLUMN "TextsJson" TYPE text USING "TextsJson"::text;
                """);

            migrationBuilder.CreateTable(
                name: "CourtCatalogEntries",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CircuitsJson = table.Column<string>(type: "jsonb", nullable: false),
                    City = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Court = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourtCatalogEntries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Regions_IsActive",
                schema: "platform",
                table: "Regions",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Districts_IsActive",
                schema: "platform",
                table: "Districts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Courts_IsActive",
                schema: "platform",
                table: "Courts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_CourtCircuits_IsActive",
                schema: "platform",
                table: "CourtCircuits",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Cities_IsActive",
                schema: "platform",
                table: "Cities",
                column: "IsActive");
        }
    }
}
