using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// The server no longer renders the deposit / final report PDFs, so the stored bytes go away.
/// The frozen snapshot, certificate and stage timestamps stay.
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20261004120000_DropReportIssuancePdfs")]
public partial class DropReportIssuancePdfs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "DepositPdf",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.DropColumn(
            name: "FinalPdf",
            schema: "valuation",
            table: "ValuationReportIssuances");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<byte[]>(
            name: "DepositPdf",
            schema: "valuation",
            table: "ValuationReportIssuances",
            type: "bytea",
            nullable: false,
            defaultValue: new byte[0]);

        migrationBuilder.AddColumn<byte[]>(
            name: "FinalPdf",
            schema: "valuation",
            table: "ValuationReportIssuances",
            type: "bytea",
            nullable: true);
    }
}
