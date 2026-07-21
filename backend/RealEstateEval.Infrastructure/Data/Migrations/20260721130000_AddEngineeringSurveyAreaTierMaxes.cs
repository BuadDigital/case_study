using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>Editable engineering-survey area tier upper bounds (م²).</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260721130000_AddEngineeringSurveyAreaTierMaxes")]
public partial class AddEngineeringSurveyAreaTierMaxes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier1MaxM2" numeric(12,2) NOT NULL DEFAULT 500;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier2MaxM2" numeric(12,2) NOT NULL DEFAULT 1000;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier3MaxM2" numeric(12,2) NOT NULL DEFAULT 1500;

            ALTER TABLE financial."PartyFeePricingConfigs"
            ADD COLUMN IF NOT EXISTS "EngineeringSurveyAreaTier4MaxM2" numeric(12,2) NOT NULL DEFAULT 10000;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier1MaxM2";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier2MaxM2";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier3MaxM2";

            ALTER TABLE financial."PartyFeePricingConfigs"
            DROP COLUMN IF EXISTS "EngineeringSurveyAreaTier4MaxM2";
            """);
    }
}
