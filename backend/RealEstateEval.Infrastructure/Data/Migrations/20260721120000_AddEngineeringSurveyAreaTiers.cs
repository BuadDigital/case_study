using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>Engineering survey area-tier fees; employee fee stays unused by resolve logic.</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260721120000_AddEngineeringSurveyAreaTiers")]
public partial class AddEngineeringSurveyAreaTiers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier1FeeSar" numeric(12,2) NOT NULL DEFAULT 300;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier2FeeSar" numeric(12,2) NOT NULL DEFAULT 450;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier3FeeSar" numeric(12,2) NOT NULL DEFAULT 900;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier4FeeSar" numeric(12,2) NOT NULL DEFAULT 1500;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier5FeeSar" numeric(12,2) NOT NULL DEFAULT 4000;

            UPDATE financial."PartyFeePricingConfigs"
            SET
                "EngineeringSurveyAreaTier1FeeSar" = CASE
                    WHEN "EngineeringSurveyAreaTier1FeeSar" = 300 AND "EngineeringSurveyFeeSar" > 0
                        THEN "EngineeringSurveyFeeSar"
                    ELSE "EngineeringSurveyAreaTier1FeeSar"
                END
            WHERE "Id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier1FeeSar";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier2FeeSar";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier3FeeSar";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier4FeeSar";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier5FeeSar";
            """);
    }
}
