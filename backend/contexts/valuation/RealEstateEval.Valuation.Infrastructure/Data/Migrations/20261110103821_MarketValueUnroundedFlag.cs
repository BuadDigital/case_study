using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Per-request flag: a request deposited or done before the market rounding keeps its unrounded market
    /// value; new deposits keep the rounded one (the deposit-status exemption flipped them after deposit).
    /// </summary>
    public partial class MarketValueUnroundedFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "MarketValueUnrounded",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // The requests already deposited (current copy) or done keep the unrounded market value they
            // were handed over with; every later deposit keeps the rounded one (2026-11-10).
            migrationBuilder.Sql("""
                UPDATE valuation."ValuationMarketApproaches" m
                SET "MarketValueUnrounded" = TRUE
                WHERE EXISTS (
                        SELECT 1 FROM valuation."ValuationReportIssuances" i
                        WHERE i."ValuationRequestId" = m."ValuationRequestId" AND i."SupersededAtUtc" IS NULL)
                   OR EXISTS (
                        SELECT 1 FROM valuation."ValuationRequests" r
                        WHERE r."Id" = m."ValuationRequestId" AND r."Status" = 'done');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MarketValueUnrounded",
                schema: "valuation",
                table: "ValuationMarketApproaches");
        }
    }
}
