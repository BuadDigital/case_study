using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// تكميلية ق-9 (ر2): نسخ الإيداع N+1 — النسخة الملغاة «حلّت محلها نسخة أحدث» تبقى بالملف؛
/// السريان محكوم بفهرس فريد جزئي (SupersededAtUtc IS NULL).
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260828160000_ReportIssuanceVersioning")]
public partial class ReportIssuanceVersioning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "Version",
            schema: "valuation",
            table: "ValuationReportIssuances",
            type: "integer",
            nullable: false,
            defaultValue: 1);

        migrationBuilder.AddColumn<DateTime>(
            name: "SupersededAtUtc",
            schema: "valuation",
            table: "ValuationReportIssuances",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SupersededByUserId",
            schema: "valuation",
            table: "ValuationReportIssuances",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SupersededReason",
            schema: "valuation",
            table: "ValuationReportIssuances",
            type: "character varying(1024)",
            maxLength: 1024,
            nullable: true);

        migrationBuilder.DropIndex(
            name: "IX_ValuationReportIssuances_ValuationRequestId",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.CreateIndex(
            name: "IX_ValuationReportIssuances_ValuationRequestId",
            schema: "valuation",
            table: "ValuationReportIssuances",
            column: "ValuationRequestId",
            unique: true,
            filter: "\"SupersededAtUtc\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "IX_ValuationReportIssuances_ValuationRequestId_Version",
            schema: "valuation",
            table: "ValuationReportIssuances",
            columns: new[] { "ValuationRequestId", "Version" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_ValuationReportIssuances_ValuationRequestId_Version",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.DropIndex(
            name: "IX_ValuationReportIssuances_ValuationRequestId",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.CreateIndex(
            name: "IX_ValuationReportIssuances_ValuationRequestId",
            schema: "valuation",
            table: "ValuationReportIssuances",
            column: "ValuationRequestId",
            unique: true);

        migrationBuilder.DropColumn(
            name: "SupersededReason",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.DropColumn(
            name: "SupersededByUserId",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.DropColumn(
            name: "SupersededAtUtc",
            schema: "valuation",
            table: "ValuationReportIssuances");

        migrationBuilder.DropColumn(
            name: "Version",
            schema: "valuation",
            table: "ValuationReportIssuances");
    }
}
