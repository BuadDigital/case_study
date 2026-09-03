using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddReportIssuances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationReportIssuances",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepositIssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DepositIssuedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    DocumentJson = table.Column<string>(type: "text", nullable: false),
                    DepositPdf = table.Column<byte[]>(type: "bytea", nullable: false),
                    DepositCode = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CertificateFileName = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    CertificateContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CertificateContent = table.Column<byte[]>(type: "bytea", nullable: true),
                    CertificateUploadedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CertificateUploadedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    FinalIssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalPdf = table.Column<byte[]>(type: "bytea", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationReportIssuances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ValuationReportIssuances_ValuationRequests_ValuationRequest~",
                        column: x => x.ValuationRequestId,
                        principalSchema: "valuation",
                        principalTable: "ValuationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ValuationReportIssuances_ValuationRequestId",
                schema: "valuation",
                table: "ValuationReportIssuances",
                column: "ValuationRequestId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ValuationReportIssuances",
                schema: "valuation");
        }
    }
}
