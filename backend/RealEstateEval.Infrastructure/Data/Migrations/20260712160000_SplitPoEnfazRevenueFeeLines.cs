using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Split EnfazFeeSar into CaseStudyFeeSar + SurveyFeeSar (agreed finance model).
/// </summary>
public partial class SplitPoEnfazRevenueFeeLines : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PoEnfazRevenueLines"
                ADD COLUMN IF NOT EXISTS "CaseStudyFeeSar" numeric(12,2) NOT NULL DEFAULT 0;

            ALTER TABLE financial."PoEnfazRevenueLines"
                ADD COLUMN IF NOT EXISTS "SurveyFeeSar" numeric(12,2) NOT NULL DEFAULT 0;

            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'financial'
                      AND table_name = 'PoEnfazRevenueLines'
                      AND column_name = 'EnfazFeeSar'
                ) THEN
                    UPDATE financial."PoEnfazRevenueLines"
                    SET "CaseStudyFeeSar" = "EnfazFeeSar",
                        "SurveyFeeSar" = 0
                    WHERE "CaseStudyFeeSar" = 0 AND "SurveyFeeSar" = 0 AND "EnfazFeeSar" <> 0;

                    ALTER TABLE financial."PoEnfazRevenueLines"
                        DROP COLUMN IF EXISTS "EnfazFeeSar";
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE financial."PoEnfazRevenueLines"
                ADD COLUMN IF NOT EXISTS "EnfazFeeSar" numeric(12,2) NOT NULL DEFAULT 0;

            UPDATE financial."PoEnfazRevenueLines"
            SET "EnfazFeeSar" = COALESCE("CaseStudyFeeSar", 0) + COALESCE("SurveyFeeSar", 0);

            ALTER TABLE financial."PoEnfazRevenueLines"
                DROP COLUMN IF EXISTS "CaseStudyFeeSar";

            ALTER TABLE financial."PoEnfazRevenueLines"
                DROP COLUMN IF EXISTS "SurveyFeeSar";
            """);
    }
}
