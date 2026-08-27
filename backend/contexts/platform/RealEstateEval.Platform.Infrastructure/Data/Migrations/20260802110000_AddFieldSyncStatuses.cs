using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations
{
    [DbContext(typeof(PlatformDbContext))]
    [Migration("20260802110000_AddFieldSyncStatuses")]
    public partial class AddFieldSyncStatuses : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FieldSyncStatuses",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    RoleId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PendingCount = table.Column<int>(type: "integer", nullable: false),
                    OldestPendingAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastSeenAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    KindsJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldSyncStatuses", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FieldSyncStatuses_UserId",
                schema: "platform",
                table: "FieldSyncStatuses",
                column: "UserId",
                unique: true);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FieldSyncStatuses",
                schema: "platform");
        }
    }
}
