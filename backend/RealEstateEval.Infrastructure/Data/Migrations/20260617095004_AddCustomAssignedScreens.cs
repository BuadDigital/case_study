using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomAssignedScreens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomAssignedScreens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    TargetPageId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IconPath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomAssignedScreens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomAssignedScreenUsers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    AssignedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomAssignedScreenUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomAssignedScreenUsers_CustomAssignedScreens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "CustomAssignedScreens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomAssignedScreens_SortOrder",
                table: "CustomAssignedScreens",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAssignedScreenUsers_ScreenId_UserId",
                table: "CustomAssignedScreenUsers",
                columns: new[] { "ScreenId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomAssignedScreenUsers_UserId",
                table: "CustomAssignedScreenUsers",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomAssignedScreenUsers");

            migrationBuilder.DropTable(
                name: "CustomAssignedScreens");
        }
    }
}
