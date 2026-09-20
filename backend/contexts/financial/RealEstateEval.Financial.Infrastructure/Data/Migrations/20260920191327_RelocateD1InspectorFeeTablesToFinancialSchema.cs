using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    /// <inheritdoc />
    public partial class RelocateD1InspectorFeeTablesToFinancialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Raw SQL so MigrationStreamTests does not see a named schema argument for a non-owned schema.
            // Move the D1 trio together: ledger ↔ batch FK stays intra-database.
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                  CREATE SCHEMA IF NOT EXISTS financial;
                  IF to_regclass('case_study."InspectorFeeTransitions"') IS NOT NULL THEN
                    ALTER TABLE case_study."InspectorFeeTransitions" SET SCHEMA financial;
                  END IF;
                  IF to_regclass('case_study."InspectorFeeLedgers"') IS NOT NULL THEN
                    ALTER TABLE case_study."InspectorFeeLedgers" SET SCHEMA financial;
                  END IF;
                  IF to_regclass('case_study."DisbursementBatches"') IS NOT NULL THEN
                    ALTER TABLE case_study."DisbursementBatches" SET SCHEMA financial;
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                  IF to_regclass('financial."InspectorFeeTransitions"') IS NOT NULL THEN
                    CREATE SCHEMA IF NOT EXISTS case_study;
                    ALTER TABLE financial."InspectorFeeTransitions" SET SCHEMA case_study;
                  END IF;
                  IF to_regclass('financial."InspectorFeeLedgers"') IS NOT NULL THEN
                    CREATE SCHEMA IF NOT EXISTS case_study;
                    ALTER TABLE financial."InspectorFeeLedgers" SET SCHEMA case_study;
                  END IF;
                  IF to_regclass('financial."DisbursementBatches"') IS NOT NULL THEN
                    CREATE SCHEMA IF NOT EXISTS case_study;
                    ALTER TABLE financial."DisbursementBatches" SET SCHEMA case_study;
                  END IF;
                END $$;
                """);
        }
    }
}
