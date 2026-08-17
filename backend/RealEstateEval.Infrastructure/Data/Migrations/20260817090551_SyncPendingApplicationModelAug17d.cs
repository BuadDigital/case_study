using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class SyncPendingApplicationModelAug17d : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Snapshot mirrors valuation.ValuationApproachSettings purpose/specialist columns
 // owned by the ValuationDbContext stream (AddPurposeAndSpecialistToApproachSettings).
 // Do not add the columns again on the frozen legacy ApplicationDbContext stream.
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
