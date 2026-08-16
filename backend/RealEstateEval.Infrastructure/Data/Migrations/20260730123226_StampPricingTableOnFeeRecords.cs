using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class StampPricingTableOnFeeRecords : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PricingTableId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PricingTableId",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InspectorFeeLedgers_PricingTableId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                column: "PricingTableId");

            migrationBuilder.CreateIndex(
                name: "IX_CourtVisitFeeCharges_PricingTableId",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                column: "PricingTableId");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InspectorFeeLedgers_PricingTableId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropIndex(
                name: "IX_CourtVisitFeeCharges_PricingTableId",
                schema: "financial",
                table: "CourtVisitFeeCharges");

            migrationBuilder.DropColumn(
                name: "PricingTableId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "PricingTableId",
                schema: "financial",
                table: "CourtVisitFeeCharges");
        }
    }
}
