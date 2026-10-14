using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class AddValuationReportDrafts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationReportDrafts",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    SpecialistChoicesJson = table.Column<string>(type: "jsonb", nullable: false),
                    SpecialistNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AppraiserNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ConformityConfirmedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConformityConfirmedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SentByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ReportDate = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SnapshotHtmlGz = table.Column<byte[]>(type: "bytea", nullable: true),
                    SnapshotSha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    SnapshotHtmlBytes = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationReportDrafts", x => x.Id);
                    table.CheckConstraint("CK_ValuationReportDrafts_Status", "\"Status\" IS NULL OR \"Status\" IN ('preparing', 'sent', 'approved')");
                    table.ForeignKey(
                        name: "FK_ValuationReportDrafts_ValuationRequests_ValuationRequestId",
                        column: x => x.ValuationRequestId,
                        principalSchema: "valuation",
                        principalTable: "ValuationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ValuationReportDrafts_ValuationRequestId_Version",
                schema: "valuation",
                table: "ValuationReportDrafts",
                columns: new[] { "ValuationRequestId", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ValuationReportDrafts",
                schema: "valuation");
        }
    }
}
