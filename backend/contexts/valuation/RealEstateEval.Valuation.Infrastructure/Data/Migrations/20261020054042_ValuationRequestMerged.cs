using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ValuationRequestMerged : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ValuationRequests_PropertyId_Open",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationRequests_Status",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.AddColumn<Guid>(
                name: "MergedIntoRequestId",
                schema: "valuation",
                table: "ValuationRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_MergedIntoRequestId",
                schema: "valuation",
                table: "ValuationRequests",
                column: "MergedIntoRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_PropertyId_Open",
                schema: "valuation",
                table: "ValuationRequests",
                column: "PropertyId",
                unique: true,
                filter: "\"Status\" <> 'done' AND \"Status\" <> 'merged'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationRequests_Status",
                schema: "valuation",
                table: "ValuationRequests",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('progress', 'done', 'fail', 'merged')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ValuationRequests_MergedIntoRequestId",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropIndex(
                name: "IX_ValuationRequests_PropertyId_Open",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationRequests_Status",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropColumn(
                name: "MergedIntoRequestId",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_PropertyId_Open",
                schema: "valuation",
                table: "ValuationRequests",
                column: "PropertyId",
                unique: true,
                filter: "\"Status\" <> 'done'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationRequests_Status",
                schema: "valuation",
                table: "ValuationRequests",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('progress', 'done', 'fail')");
        }
    }
}
