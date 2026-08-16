using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <summary>
 /// No-op. PhotoMetadata is shaped by the Attachments stream
 /// (<c>20260802055103_AddPhotoMetadata</c>). An earlier revision of this
 /// migration recreated that table on the legacy stream after the cutover,
 /// which bounded-context split forbids.
 /// </summary>
    public partial class SyncPendingModelChangesAug2026 : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
