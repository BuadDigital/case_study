using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>Enfaz invoice collection fields + key entitlement fee lines on PO billing.</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260802071000_AddEnfazInvoiceCollectionAndKeyFees")]
public partial class AddEnfazInvoiceCollectionAndKeyFees : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Status",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "issued");

        migrationBuilder.AddColumn<decimal>(
            name: "SubtotalSar",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "numeric(14,2)",
            precision: 14,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "VatSar",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "numeric(14,2)",
            precision: 14,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "TotalSar",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "numeric(14,2)",
            precision: 14,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "CollectedAmountSar",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "numeric(14,2)",
            precision: 14,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<DateTime>(
            name: "CollectedAtUtc",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "AttachmentIdsJson",
            schema: "financial",
            table: "PoEnfazInvoices",
            type: "jsonb",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "KeyFeeSar",
            schema: "financial",
            table: "PoEnfazRevenueLines",
            type: "numeric(12,2)",
            precision: 12,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<Guid>(
            name: "KeyEntitlementEnvelopeId",
            schema: "financial",
            table: "PoEnfazRevenueLines",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_PoEnfazRevenueLines_KeyEntitlementEnvelopeId",
            schema: "financial",
            table: "PoEnfazRevenueLines",
            column: "KeyEntitlementEnvelopeId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_PoEnfazRevenueLines_KeyEntitlementEnvelopeId",
            schema: "financial",
            table: "PoEnfazRevenueLines");

        migrationBuilder.DropColumn(
            name: "KeyEntitlementEnvelopeId",
            schema: "financial",
            table: "PoEnfazRevenueLines");

        migrationBuilder.DropColumn(
            name: "KeyFeeSar",
            schema: "financial",
            table: "PoEnfazRevenueLines");

        migrationBuilder.DropColumn(
            name: "AttachmentIdsJson",
            schema: "financial",
            table: "PoEnfazInvoices");

        migrationBuilder.DropColumn(
            name: "CollectedAtUtc",
            schema: "financial",
            table: "PoEnfazInvoices");

        migrationBuilder.DropColumn(
            name: "CollectedAmountSar",
            schema: "financial",
            table: "PoEnfazInvoices");

        migrationBuilder.DropColumn(
            name: "TotalSar",
            schema: "financial",
            table: "PoEnfazInvoices");

        migrationBuilder.DropColumn(
            name: "VatSar",
            schema: "financial",
            table: "PoEnfazInvoices");

        migrationBuilder.DropColumn(
            name: "SubtotalSar",
            schema: "financial",
            table: "PoEnfazInvoices");

        migrationBuilder.DropColumn(
            name: "Status",
            schema: "financial",
            table: "PoEnfazInvoices");
    }
}
