using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260721150000_AddPartyFeePricingCategory")]
public partial class AddPartyFeePricingCategory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingTables"
            ADD COLUMN IF NOT EXISTS "Category" character varying(32) NOT NULL DEFAULT 'engineering-survey';

            UPDATE financial."PartyFeePricingTables"
            SET "Category" = 'engineering-survey'
            WHERE "Category" IS NULL OR "Category" = '';

            DROP INDEX IF EXISTS financial."IX_PartyFeePricingTables_OneActive";

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyFeePricingTables_Category_OneActive"
                ON financial."PartyFeePricingTables" ("Category")
                WHERE "IsActive" = true;

            INSERT INTO financial."PartyFeePricingTables" (
                "Id", "Name", "Category", "IsActive",
                "GovernmentReviewFeeSar", "KeyReceiptFeeSar",
                "FieldInspectorIndividualFeeSar", "FieldInspectorOrganizationFeeSar",
                "UpdatedAtUtc"
            )
            SELECT
                'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,
                'المراجع الحكومي — افتراضي',
                'government-review',
                true,
                COALESCE(src."GovernmentReviewFeeSar", 350),
                COALESCE(NULLIF(src."KeyReceiptFeeSar", 0), src."GovernmentReviewFeeSar", 350),
                0, 0,
                NOW() AT TIME ZONE 'utc'
            FROM (
                SELECT *
                FROM financial."PartyFeePricingTables"
                ORDER BY "IsActive" DESC, "UpdatedAtUtc" DESC
                LIMIT 1
            ) src
            WHERE NOT EXISTS (
                SELECT 1 FROM financial."PartyFeePricingTables" t
                WHERE t."Category" = 'government-review'
            );

            INSERT INTO financial."PartyFeePricingTables" (
                "Id", "Name", "Category", "IsActive",
                "GovernmentReviewFeeSar", "KeyReceiptFeeSar",
                "FieldInspectorIndividualFeeSar", "FieldInspectorOrganizationFeeSar",
                "UpdatedAtUtc"
            )
            SELECT
                'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,
                'المعاين الميداني — افتراضي',
                'field-inspector',
                true,
                0, 0,
                COALESCE(src."FieldInspectorIndividualFeeSar", 400),
                COALESCE(src."FieldInspectorOrganizationFeeSar", 500),
                NOW() AT TIME ZONE 'utc'
            FROM (
                SELECT *
                FROM financial."PartyFeePricingTables"
                ORDER BY "IsActive" DESC, "UpdatedAtUtc" DESC
                LIMIT 1
            ) src
            WHERE NOT EXISTS (
                SELECT 1 FROM financial."PartyFeePricingTables" t
                WHERE t."Category" = 'field-inspector'
            );

            UPDATE financial."PartyFeePricingTables"
            SET "IsActive" = false
            WHERE "Category" <> 'engineering-survey'
              AND "Id" NOT IN (
                  SELECT DISTINCT ON ("Category") "Id"
                  FROM financial."PartyFeePricingTables"
                  ORDER BY "Category", "IsActive" DESC, "UpdatedAtUtc" DESC
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS financial."IX_PartyFeePricingTables_Category_OneActive";

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyFeePricingTables_OneActive"
                ON financial."PartyFeePricingTables" ("IsActive")
                WHERE "IsActive" = true;

            ALTER TABLE financial."PartyFeePricingTables"
            DROP COLUMN IF EXISTS "Category";
            """);
    }
}
