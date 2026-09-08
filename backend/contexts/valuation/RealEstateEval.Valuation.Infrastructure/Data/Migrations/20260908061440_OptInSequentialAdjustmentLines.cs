using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class OptInSequentialAdjustmentLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE valuation."ValuationComparableAdjustmentLines"
                SET "IsIncluded" = false
                WHERE "FactorKey" IN ('financing', 'transaction_type')
                  AND "IsIncluded" = true
                  AND "Percent" = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE valuation."ValuationComparableAdjustmentLines"
                SET "IsIncluded" = true
                WHERE "FactorKey" IN ('financing', 'transaction_type')
                  AND "IsIncluded" = false
                  AND "Percent" = 0;
                """);
        }
    }
}
