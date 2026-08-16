using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <summary>
 /// Financial pricing cleanup only. The KeyEnvelopes column lives on the Operations stream
 /// as of extraction; do not reshape <c>operations</c> from the legacy
 /// stream after the cutover.
 /// </summary>
    public partial class KeyReceiptRevenueOutOfPricing : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KeyReceiptFeeSar",
                schema: "financial",
                table: "PartyFeePricingTables");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
