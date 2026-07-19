using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260719180000_KeyEnvelopeIntegration")]
public partial class KeyEnvelopeIntegration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "KeyReceiptFeeSar" numeric(12,2) NOT NULL DEFAULT 350;

            UPDATE financial."PartyFeePricingConfigs"
            SET "KeyReceiptFeeSar" = "GovernmentReviewFeeSar"
            WHERE "KeyReceiptFeeSar" = 0 OR "KeyReceiptFeeSar" IS NULL;
            """);

        migrationBuilder.CreateTable(
            name: "KeyReceiptFeeCharges",
            schema: "financial",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EnvelopeId = table.Column<Guid>(type: "uuid", nullable: false),
                RequestNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                AmountSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                CollectionStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                PhotoAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                ReceiptAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                InvoiceReference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                CollectedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_KeyReceiptFeeCharges", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_KeyReceiptFeeCharges_EnvelopeId",
            schema: "financial",
            table: "KeyReceiptFeeCharges",
            column: "EnvelopeId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_KeyReceiptFeeCharges_RequestNumber",
            schema: "financial",
            table: "KeyReceiptFeeCharges",
            column: "RequestNumber");

        migrationBuilder.CreateIndex(
            name: "IX_KeyReceiptFeeCharges_CollectionStatus",
            schema: "financial",
            table: "KeyReceiptFeeCharges",
            column: "CollectionStatus");

        migrationBuilder.Sql(
            """
            INSERT INTO financial."KeyReceiptFeeCharges" (
                "Id", "EnvelopeId", "RequestNumber", "AmountSar", "CollectionStatus",
                "PhotoAttachmentId", "ReceiptAttachmentId",
                "CreatedByUserId", "CreatedByName", "CreatedAtUtc", "UpdatedAtUtc"
            )
            SELECT
                gen_random_uuid(),
                e."Id",
                e."RequestNumber",
                COALESCE(e."FeeAmountSar", 350),
                'open',
                e."PhotoAttachmentId",
                e."ReceiptAttachmentId",
                e."CreatedByUserId",
                e."CreatedByName",
                e."CreatedAtUtc",
                e."UpdatedAtUtc"
            FROM operations."KeyEnvelopes" e
            WHERE e."FeeGenerated" = TRUE
              AND NOT EXISTS (
                SELECT 1 FROM financial."KeyReceiptFeeCharges" c WHERE c."EnvelopeId" = e."Id"
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "KeyReceiptFeeCharges", schema: "financial");
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "KeyReceiptFeeSar";
            """);
    }
}
