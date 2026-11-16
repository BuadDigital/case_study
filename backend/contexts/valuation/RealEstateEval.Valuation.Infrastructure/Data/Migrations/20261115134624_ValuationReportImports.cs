using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// The tables behind «استيراد تقارير التقييم» and the map's «تقارير التقييم» layer: the imported
    /// reports (one row per source + report number, unique) and the log of each uploaded file.
    /// </summary>
    /// <remarks>
    /// The feature's commit carried the model without a migration; on the developer database the two
    /// tables had been created by hand with this exact shape, so there the migration is recorded as
    /// applied instead of run. Down drops both tables with their rows.
    /// </remarks>
    public partial class ValuationReportImports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImportedValuationReports",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ReportNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ReportNumberValue = table.Column<long>(type: "bigint", nullable: false),
                    Template = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Approver = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ApprovedAt = table.Column<DateOnly>(type: "date", nullable: true),
                    Client = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    DeedNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PropertyType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Inspector = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    Usage = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    LandArea = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    FinalValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    InspectionAuditor = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ValuationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ImportBatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportedValuationReports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ValuationReportImportBatches",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    ImportedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ImportedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalRows = table.Column<int>(type: "integer", nullable: false),
                    NewCount = table.Column<int>(type: "integer", nullable: false),
                    ReplacedCount = table.Column<int>(type: "integer", nullable: false),
                    RejectedCount = table.Column<int>(type: "integer", nullable: false),
                    MaxReportNumberValue = table.Column<long>(type: "bigint", nullable: false),
                    MaxReportNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationReportImportBatches", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportedValuationReports_Source_ReportNumber",
                schema: "valuation",
                table: "ImportedValuationReports",
                columns: new[] { "Source", "ReportNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ValuationReportImportBatches_Source_ImportedAtUtc",
                schema: "valuation",
                table: "ValuationReportImportBatches",
                columns: new[] { "Source", "ImportedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportedValuationReports",
                schema: "valuation");

            migrationBuilder.DropTable(
                name: "ValuationReportImportBatches",
                schema: "valuation");
        }
    }
}
