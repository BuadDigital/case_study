using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class KeyReceiptRevenueOutOfPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KeyReceiptFeeSar",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.AddColumn<DateTime>(
                name: "RevenueEntitlementAtUtc",
                schema: "operations",
                table: "KeyEnvelopes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_RevenueEntitlementAtUtc",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "RevenueEntitlementAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_KeyEnvelopes_RevenueEntitlementAtUtc",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropColumn(
                name: "RevenueEntitlementAtUtc",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.AddColumn<decimal>(
                name: "KeyReceiptFeeSar",
                schema: "financial",
                table: "PartyFeePricingTables",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }
    }
}
