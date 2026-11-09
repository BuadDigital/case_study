using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReportDraftInReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationReportDrafts_Status",
                schema: "valuation",
                table: "ValuationReportDrafts");

            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                schema: "valuation",
                table: "ValuationReportDrafts",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedForReviewAtUtc",
                schema: "valuation",
                table: "ValuationReportDrafts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedForReviewByUserId",
                schema: "valuation",
                table: "ValuationReportDrafts",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationReportDrafts_Status",
                schema: "valuation",
                table: "ValuationReportDrafts",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('preparing', 'in_review', 'sent', 'approved')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationReportDrafts_Status",
                schema: "valuation",
                table: "ValuationReportDrafts");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                schema: "valuation",
                table: "ValuationReportDrafts");

            migrationBuilder.DropColumn(
                name: "SubmittedForReviewAtUtc",
                schema: "valuation",
                table: "ValuationReportDrafts");

            migrationBuilder.DropColumn(
                name: "SubmittedForReviewByUserId",
                schema: "valuation",
                table: "ValuationReportDrafts");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationReportDrafts_Status",
                schema: "valuation",
                table: "ValuationReportDrafts",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('preparing', 'sent', 'approved')");
        }
    }
}
