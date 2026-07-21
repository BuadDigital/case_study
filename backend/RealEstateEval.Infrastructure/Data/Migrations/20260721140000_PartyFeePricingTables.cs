using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>Named pricing tables with dynamic area tiers (replaces singleton PartyFeePricingConfigs).</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260721140000_PartyFeePricingTables")]
public partial class PartyFeePricingTables : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingTables" (
                "Id" uuid NOT NULL,
                "Name" character varying(128) NOT NULL,
                "IsActive" boolean NOT NULL DEFAULT false,
                "GovernmentReviewFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "KeyReceiptFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "FieldInspectorIndividualFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "FieldInspectorOrganizationFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PartyFeePricingTables" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingTiers" (
                "Id" uuid NOT NULL,
                "TableId" uuid NOT NULL,
                "SortOrder" integer NOT NULL,
                "MaxAreaM2" numeric(12,2) NULL,
                "FeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                CONSTRAINT "PK_PartyFeePricingTiers" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_PartyFeePricingTiers_Tables_TableId"
                    FOREIGN KEY ("TableId") REFERENCES financial."PartyFeePricingTables" ("Id") ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IX_PartyFeePricingTiers_TableId_SortOrder"
                ON financial."PartyFeePricingTiers" ("TableId", "SortOrder");

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyFeePricingTables_OneActive"
                ON financial."PartyFeePricingTables" ("IsActive")
                WHERE "IsActive" = true;

            INSERT INTO financial."PartyFeePricingTables" (
                "Id", "Name", "IsActive",
                "GovernmentReviewFeeSar", "KeyReceiptFeeSar",
                "FieldInspectorIndividualFeeSar", "FieldInspectorOrganizationFeeSar",
                "UpdatedAtUtc"
            )
            SELECT
                c."Id",
                'التسعيرة الافتراضية',
                true,
                c."GovernmentReviewFeeSar",
                CASE WHEN c."KeyReceiptFeeSar" > 0 THEN c."KeyReceiptFeeSar" ELSE c."GovernmentReviewFeeSar" END,
                c."FieldInspectorIndividualFeeSar",
                c."FieldInspectorOrganizationFeeSar",
                c."UpdatedAtUtc"
            FROM financial."PartyFeePricingConfigs" c
            WHERE NOT EXISTS (SELECT 1 FROM financial."PartyFeePricingTables")
            ORDER BY c."UpdatedAtUtc" DESC
            LIMIT 1;

            INSERT INTO financial."PartyFeePricingTables" (
                "Id", "Name", "IsActive",
                "GovernmentReviewFeeSar", "KeyReceiptFeeSar",
                "FieldInspectorIndividualFeeSar", "FieldInspectorOrganizationFeeSar",
                "UpdatedAtUtc"
            )
            SELECT
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
                'التسعيرة الافتراضية',
                true,
                350, 350, 400, 500,
                NOW() AT TIME ZONE 'utc'
            WHERE NOT EXISTS (SELECT 1 FROM financial."PartyFeePricingTables");

            INSERT INTO financial."PartyFeePricingTiers" ("Id", "TableId", "SortOrder", "MaxAreaM2", "FeeSar")
            SELECT gen_random_uuid(), t."Id", v."SortOrder", v."MaxAreaM2", v."FeeSar"
            FROM financial."PartyFeePricingTables" t
            CROSS JOIN LATERAL (
                SELECT * FROM (
                    VALUES
                        (0, COALESCE((SELECT "EngineeringSurveyAreaTier1MaxM2" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 500),
                            COALESCE((SELECT "EngineeringSurveyAreaTier1FeeSar" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 300)),
                        (1, COALESCE((SELECT "EngineeringSurveyAreaTier2MaxM2" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 1000),
                            COALESCE((SELECT "EngineeringSurveyAreaTier2FeeSar" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 450)),
                        (2, COALESCE((SELECT "EngineeringSurveyAreaTier3MaxM2" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 1500),
                            COALESCE((SELECT "EngineeringSurveyAreaTier3FeeSar" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 900)),
                        (3, COALESCE((SELECT "EngineeringSurveyAreaTier4MaxM2" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 10000),
                            COALESCE((SELECT "EngineeringSurveyAreaTier4FeeSar" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 1500)),
                        (4, NULL::numeric,
                            COALESCE((SELECT "EngineeringSurveyAreaTier5FeeSar" FROM financial."PartyFeePricingConfigs" ORDER BY "UpdatedAtUtc" DESC LIMIT 1), 4000))
                ) AS x("SortOrder", "MaxAreaM2", "FeeSar")
            ) v
            WHERE NOT EXISTS (
                SELECT 1 FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id"
            );

            DROP TABLE IF EXISTS financial."PartyFeePricingConfigs";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingConfigs" (
                "Id" uuid NOT NULL,
                "EngineeringSurveyFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "EngineeringSurveyAreaTier1MaxM2" numeric(12,2) NOT NULL DEFAULT 500,
                "EngineeringSurveyAreaTier2MaxM2" numeric(12,2) NOT NULL DEFAULT 1000,
                "EngineeringSurveyAreaTier3MaxM2" numeric(12,2) NOT NULL DEFAULT 1500,
                "EngineeringSurveyAreaTier4MaxM2" numeric(12,2) NOT NULL DEFAULT 10000,
                "EngineeringSurveyAreaTier1FeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "EngineeringSurveyAreaTier2FeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "EngineeringSurveyAreaTier3FeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "EngineeringSurveyAreaTier4FeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "EngineeringSurveyAreaTier5FeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "GovernmentReviewFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "KeyReceiptFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "FieldInspectorIndividualFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "FieldInspectorOrganizationFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "FieldInspectorEmployeeFeeSar" numeric(12,2) NOT NULL DEFAULT 0,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PartyFeePricingConfigs" PRIMARY KEY ("Id")
            );

            INSERT INTO financial."PartyFeePricingConfigs" (
                "Id",
                "EngineeringSurveyFeeSar",
                "EngineeringSurveyAreaTier1MaxM2",
                "EngineeringSurveyAreaTier2MaxM2",
                "EngineeringSurveyAreaTier3MaxM2",
                "EngineeringSurveyAreaTier4MaxM2",
                "EngineeringSurveyAreaTier1FeeSar",
                "EngineeringSurveyAreaTier2FeeSar",
                "EngineeringSurveyAreaTier3FeeSar",
                "EngineeringSurveyAreaTier4FeeSar",
                "EngineeringSurveyAreaTier5FeeSar",
                "GovernmentReviewFeeSar",
                "KeyReceiptFeeSar",
                "FieldInspectorIndividualFeeSar",
                "FieldInspectorOrganizationFeeSar",
                "FieldInspectorEmployeeFeeSar",
                "UpdatedAtUtc"
            )
            SELECT
                t."Id",
                COALESCE((SELECT tr."FeeSar" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" ORDER BY tr."SortOrder" LIMIT 1), 0),
                COALESCE((SELECT tr."MaxAreaM2" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 0), 500),
                COALESCE((SELECT tr."MaxAreaM2" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 1), 1000),
                COALESCE((SELECT tr."MaxAreaM2" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 2), 1500),
                COALESCE((SELECT tr."MaxAreaM2" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 3), 10000),
                COALESCE((SELECT tr."FeeSar" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 0), 0),
                COALESCE((SELECT tr."FeeSar" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 1), 0),
                COALESCE((SELECT tr."FeeSar" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 2), 0),
                COALESCE((SELECT tr."FeeSar" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" AND tr."SortOrder" = 3), 0),
                COALESCE((SELECT tr."FeeSar" FROM financial."PartyFeePricingTiers" tr WHERE tr."TableId" = t."Id" ORDER BY tr."SortOrder" DESC LIMIT 1), 0),
                t."GovernmentReviewFeeSar",
                t."KeyReceiptFeeSar",
                t."FieldInspectorIndividualFeeSar",
                t."FieldInspectorOrganizationFeeSar",
                0,
                t."UpdatedAtUtc"
            FROM financial."PartyFeePricingTables" t
            WHERE t."IsActive" = true
            LIMIT 1;

            DROP TABLE IF EXISTS financial."PartyFeePricingTiers";
            DROP TABLE IF EXISTS financial."PartyFeePricingTables";
            """);
    }
}
