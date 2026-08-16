using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Financial.Migrations
{
    [DbContext(typeof(FinancialDbContext))]
    [Migration("20260810090000_CourtVisitPricingFromGovernmentReview")]
    public partial class CourtVisitPricingFromGovernmentReview : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."PartyFeePricingTables"
                ADD COLUMN IF NOT EXISTS "CourtVisitFeeSar" numeric(12,2) NOT NULL DEFAULT 0;

                -- The carry-over only applies to databases created before the rename. A
                -- WHERE EXISTS guard cannot express that: Postgres resolves column names
                -- when the statement is analysed, so naming "GovernmentReviewFeeSar"
                -- directly fails with 42703 on a fresh database no matter what the guard
                -- evaluates to. EXECUTE defers analysis until the branch is actually taken.
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'financial'
                          AND table_name = 'PartyFeePricingTables'
                          AND column_name = 'GovernmentReviewFeeSar'
                    ) THEN
                        EXECUTE 'UPDATE financial."PartyFeePricingTables"
                                 SET "CourtVisitFeeSar" = COALESCE("GovernmentReviewFeeSar", 0)';
                    END IF;
                END $$;

                UPDATE financial."PartyFeePricingTables"
                SET "Category" = 'court-visit'
                WHERE "Category" = 'government-review';

                UPDATE financial."PartyFeePricingAssignments"
                SET "Category" = 'court-visit'
                WHERE "Category" = 'government-review';

                ALTER TABLE financial."PartyFeePricingTables"
                DROP COLUMN IF EXISTS "GovernmentReviewFeeSar";
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."PartyFeePricingTables"
                ADD COLUMN IF NOT EXISTS "GovernmentReviewFeeSar" numeric(12,2) NOT NULL DEFAULT 0;

                UPDATE financial."PartyFeePricingTables"
                SET "GovernmentReviewFeeSar" = COALESCE("CourtVisitFeeSar", 0);

                UPDATE financial."PartyFeePricingTables"
                SET "Category" = 'government-review'
                WHERE "Category" = 'court-visit';

                UPDATE financial."PartyFeePricingAssignments"
                SET "Category" = 'government-review'
                WHERE "Category" = 'court-visit';

                ALTER TABLE financial."PartyFeePricingTables"
                DROP COLUMN IF EXISTS "CourtVisitFeeSar";
                """);
        }
    }
}
