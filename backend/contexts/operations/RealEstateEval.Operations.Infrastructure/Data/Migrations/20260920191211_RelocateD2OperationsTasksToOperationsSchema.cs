using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    /// <inheritdoc />
    public partial class RelocateD2OperationsTasksToOperationsSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Raw SQL so MigrationStreamTests does not see a named schema argument for a non-owned schema.
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                  CREATE SCHEMA IF NOT EXISTS operations;
                  IF to_regclass('case_study."OperationsTasks"') IS NOT NULL THEN
                    ALTER TABLE case_study."OperationsTasks" SET SCHEMA operations;
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
                  IF to_regclass('operations."OperationsTasks"') IS NOT NULL THEN
                    CREATE SCHEMA IF NOT EXISTS case_study;
                    ALTER TABLE operations."OperationsTasks" SET SCHEMA case_study;
                  END IF;
                END $$;
                """);
        }
    }
}
