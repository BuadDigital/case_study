using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddFinalReportAndCertificateAttachment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CertificateAttachmentId",
                schema: "valuation",
                table: "ValuationReportIssuances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinalPdfAttachmentId",
                schema: "valuation",
                table: "ValuationReportIssuances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalPdfDepositCode",
                schema: "valuation",
                table: "ValuationReportIssuances",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinalPdfGeneratedAtUtc",
                schema: "valuation",
                table: "ValuationReportIssuances",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CertificateAttachmentId",
                schema: "valuation",
                table: "ValuationReportIssuances");

            migrationBuilder.DropColumn(
                name: "FinalPdfAttachmentId",
                schema: "valuation",
                table: "ValuationReportIssuances");

            migrationBuilder.DropColumn(
                name: "FinalPdfDepositCode",
                schema: "valuation",
                table: "ValuationReportIssuances");

            migrationBuilder.DropColumn(
                name: "FinalPdfGeneratedAtUtc",
                schema: "valuation",
                table: "ValuationReportIssuances");
        }
    }
}
