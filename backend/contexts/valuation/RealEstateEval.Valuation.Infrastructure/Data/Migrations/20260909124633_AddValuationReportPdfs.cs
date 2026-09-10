using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddValuationReportPdfs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationReportPdfs",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    FileName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Renderer = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationReportPdfs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ValuationReportPdfs_ValuationRequests_ValuationRequestId",
                        column: x => x.ValuationRequestId,
                        principalSchema: "valuation",
                        principalTable: "ValuationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ValuationReportPdfs_ValuationRequestId_CreatedAtUtc",
                schema: "valuation",
                table: "ValuationReportPdfs",
                columns: new[] { "ValuationRequestId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ValuationReportPdfs",
                schema: "valuation");
        }
    }
}
