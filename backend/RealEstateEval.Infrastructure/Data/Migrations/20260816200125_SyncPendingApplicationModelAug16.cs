using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class SyncPendingApplicationModelAug16 : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Snapshot mirrors valuation/attachments model already owned by bounded-context
 // streams (ValuationDbContext / AttachmentsDbContext). Do not create those
 // tables again on the frozen legacy ApplicationDbContext stream.
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
