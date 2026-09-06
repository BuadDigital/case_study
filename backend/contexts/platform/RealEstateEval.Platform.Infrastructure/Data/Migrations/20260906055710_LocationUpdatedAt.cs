using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations
{
    /// <inheritdoc />
    public partial class LocationUpdatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE platform."Districts" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE platform."Districts" SET "UpdatedAtUtc" = "CreatedAtUtc";
                ALTER TABLE platform."Districts" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE platform."Cities" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE platform."Cities" SET "UpdatedAtUtc" = "CreatedAtUtc";
                ALTER TABLE platform."Cities" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "platform",
                table: "Districts");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "platform",
                table: "Cities");
        }
    }
}
