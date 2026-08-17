using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class SyncPendingApplicationModelAug17c : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Snapshot mirrors valuation.ComparableProperties quality-tag columns owned by the
 // ValuationDbContext stream (AddComparableQualityTags). Do not add the columns
 // again on the frozen legacy ApplicationDbContext stream.
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
