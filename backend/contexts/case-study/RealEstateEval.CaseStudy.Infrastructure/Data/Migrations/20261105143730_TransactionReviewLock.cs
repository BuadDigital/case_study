using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TransactionReviewLock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "HandedToReviewAtUtc",
                schema: "case_study",
                table: "Transactions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HandedToReviewByUserId",
                schema: "case_study",
                table: "Transactions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewApprovedAtUtc",
                schema: "case_study",
                table: "Transactions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewApprovedByUserId",
                schema: "case_study",
                table: "Transactions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HandedToReviewAtUtc",
                schema: "case_study",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "HandedToReviewByUserId",
                schema: "case_study",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ReviewApprovedAtUtc",
                schema: "case_study",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ReviewApprovedByUserId",
                schema: "case_study",
                table: "Transactions");
        }
    }
}
