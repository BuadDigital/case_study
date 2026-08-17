using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class SyncPendingApplicationModelAug17e : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Snapshot mirrors valuation.ValuationApproachSettings date-mode/assumptions columns
 // owned by the ValuationDbContext stream (AddValuationDateAndAssumptions).
 // Do not add the columns again on the frozen legacy ApplicationDbContext stream.
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
