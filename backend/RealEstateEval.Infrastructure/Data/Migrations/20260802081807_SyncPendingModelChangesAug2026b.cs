using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncPendingModelChangesAug2026b : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Snapshot mirrors FieldSyncStatuses from PlatformModel on ApplicationDbContext.
            // Platform owns the table (20260802110000_AddFieldSyncStatuses) — do not create it here.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
