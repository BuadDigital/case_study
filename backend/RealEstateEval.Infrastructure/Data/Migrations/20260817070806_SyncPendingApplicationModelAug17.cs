using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class SyncPendingApplicationModelAug17 : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Snapshot mirrors valuation.ValuationApproachSettings, which is owned by the
 // ValuationDbContext stream (20260817090000_AddValuationApproachSettings).
 // Do not create the table again on the frozen legacy ApplicationDbContext stream.
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
