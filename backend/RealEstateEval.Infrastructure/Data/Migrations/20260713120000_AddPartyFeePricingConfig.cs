using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>Editable default party-fee pricing (singleton row).</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260713120000_AddPartyFeePricingConfig")]
public partial class AddPartyFeePricingConfig : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS financial."PartyFeePricingConfigs" (
                "Id" uuid NOT NULL,
                "EngineeringSurveyFeeSar" numeric(12,2) NOT NULL,
                "GovernmentReviewFeeSar" numeric(12,2) NOT NULL,
                "FieldInspectorIndividualFeeSar" numeric(12,2) NOT NULL,
                "FieldInspectorOrganizationFeeSar" numeric(12,2) NOT NULL,
                "FieldInspectorEmployeeFeeSar" numeric(12,2) NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PartyFeePricingConfigs" PRIMARY KEY ("Id")
            );

            INSERT INTO financial."PartyFeePricingConfigs" (
                "Id",
                "EngineeringSurveyFeeSar",
                "GovernmentReviewFeeSar",
                "FieldInspectorIndividualFeeSar",
                "FieldInspectorOrganizationFeeSar",
                "FieldInspectorEmployeeFeeSar",
                "UpdatedAtUtc"
            )
            VALUES (
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                500, 350, 400, 500, 100,
                NOW() AT TIME ZONE 'utc'
            )
            ON CONFLICT ("Id") DO NOTHING;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP TABLE IF EXISTS financial."PartyFeePricingConfigs";
            """);
    }
}
