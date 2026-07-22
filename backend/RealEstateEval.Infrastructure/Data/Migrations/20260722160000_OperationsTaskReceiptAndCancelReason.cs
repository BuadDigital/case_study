using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260722160000_OperationsTaskReceiptAndCancelReason")]
public partial class OperationsTaskReceiptAndCancelReason : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(
            name: "ReceiptConfirmedAtUtc",
            schema: "case_study",
            table: "OperationsTasks",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "CancelReason",
            schema: "case_study",
            table: "OperationsTasks",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        // Existing tasks already past «تأكيد الاستلام» keep the confirmed indicator.
        migrationBuilder.Sql(
            """
            UPDATE case_study."OperationsTasks"
            SET "ReceiptConfirmedAtUtc" = "CreatedAtUtc"
            WHERE "ReceiptConfirmedAtUtc" IS NULL
              AND (
                "Status" IN ('in_progress', 'completed')
                OR ("Status" = 'paused' AND "PrevStatus" = 'in_progress')
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ReceiptConfirmedAtUtc",
            schema: "case_study",
            table: "OperationsTasks");

        migrationBuilder.DropColumn(
            name: "CancelReason",
            schema: "case_study",
            table: "OperationsTasks");
    }
}
