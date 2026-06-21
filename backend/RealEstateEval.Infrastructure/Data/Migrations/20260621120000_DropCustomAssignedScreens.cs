using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260621120000_DropCustomAssignedScreens")]
/// <inheritdoc />
public partial class DropCustomAssignedScreens : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "CustomScreenSubmissions",
            schema: "platform");

        migrationBuilder.DropTable(
            name: "CustomAssignedScreenUsers",
            schema: "platform");

        migrationBuilder.DropTable(
            name: "CustomAssignedScreens",
            schema: "platform");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CustomAssignedScreens",
            schema: "platform",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                DefinitionJson = table.Column<string>(type: "jsonb", nullable: false),
                IconPath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                OwnerRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                ScreenStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                TargetPageId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CustomAssignedScreens", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "CustomAssignedScreenUsers",
            schema: "platform",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CustomAssignedScreenUsers", x => x.Id);
                table.ForeignKey(
                    name: "FK_CustomAssignedScreenUsers_CustomAssignedScreens_ScreenId",
                    column: x => x.ScreenId,
                    principalSchema: "platform",
                    principalTable: "CustomAssignedScreens",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "CustomScreenSubmissions",
            schema: "platform",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                AnswersJson = table.Column<string>(type: "jsonb", nullable: false),
                ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CustomScreenSubmissions", x => x.Id);
                table.ForeignKey(
                    name: "FK_CustomScreenSubmissions_CustomAssignedScreens_ScreenId",
                    column: x => x.ScreenId,
                    principalSchema: "platform",
                    principalTable: "CustomAssignedScreens",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_CustomAssignedScreens_Code",
            schema: "platform",
            table: "CustomAssignedScreens",
            column: "Code");

        migrationBuilder.CreateIndex(
            name: "IX_CustomAssignedScreens_SortOrder",
            schema: "platform",
            table: "CustomAssignedScreens",
            column: "SortOrder");

        migrationBuilder.CreateIndex(
            name: "IX_CustomAssignedScreenUsers_ScreenId_UserId",
            schema: "platform",
            table: "CustomAssignedScreenUsers",
            columns: new[] { "ScreenId", "UserId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_CustomAssignedScreenUsers_UserId",
            schema: "platform",
            table: "CustomAssignedScreenUsers",
            column: "UserId");

        migrationBuilder.CreateIndex(
            name: "IX_CustomScreenSubmissions_ScreenId_UserId",
            schema: "platform",
            table: "CustomScreenSubmissions",
            columns: new[] { "ScreenId", "UserId" },
            unique: true);
    }
}
