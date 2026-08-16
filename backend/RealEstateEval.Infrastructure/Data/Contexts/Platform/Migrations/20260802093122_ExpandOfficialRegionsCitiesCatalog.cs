using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Platform.Migrations
{
 /// <inheritdoc />
    public partial class ExpandOfficialRegionsCitiesCatalog : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Cities_RegionId_NameAr",
                schema: "platform",
                table: "Cities");

            migrationBuilder.AddColumn<int>(
                name: "AdminAreaId",
                schema: "platform",
                table: "Regions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "OfficialId",
                schema: "platform",
                table: "Regions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

 // Backfill before unique indexes — default 0 would collide across 13 rows.
            migrationBuilder.Sql(
                """
                UPDATE platform."Regions" SET "OfficialId" = 1,  "AdminAreaId" = 1  WHERE "Code" = 'RD';
                UPDATE platform."Regions" SET "OfficialId" = 2,  "AdminAreaId" = 3  WHERE "Code" = 'MK';
                UPDATE platform."Regions" SET "OfficialId" = 3,  "AdminAreaId" = 8  WHERE "Code" = 'MD';
                UPDATE platform."Regions" SET "OfficialId" = 4,  "AdminAreaId" = 9  WHERE "Code" = 'QS';
                UPDATE platform."Regions" SET "OfficialId" = 5,  "AdminAreaId" = 2  WHERE "Code" = 'EP';
                UPDATE platform."Regions" SET "OfficialId" = 6,  "AdminAreaId" = 10 WHERE "Code" = 'AS';
                UPDATE platform."Regions" SET "OfficialId" = 7,  "AdminAreaId" = 11 WHERE "Code" = 'TB';
                UPDATE platform."Regions" SET "OfficialId" = 8,  "AdminAreaId" = 12 WHERE "Code" = 'HL';
                UPDATE platform."Regions" SET "OfficialId" = 9,  "AdminAreaId" = 13 WHERE "Code" = 'NB';
                UPDATE platform."Regions" SET "OfficialId" = 10, "AdminAreaId" = 14 WHERE "Code" = 'JZ';
                UPDATE platform."Regions" SET "OfficialId" = 11, "AdminAreaId" = 15 WHERE "Code" = 'NJ';
                UPDATE platform."Regions" SET "OfficialId" = 12, "AdminAreaId" = 16 WHERE "Code" = 'BH';
                UPDATE platform."Regions" SET "OfficialId" = 13, "AdminAreaId" = 17 WHERE "Code" = 'JF';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "NameAr",
                schema: "platform",
                table: "Cities",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                schema: "platform",
                table: "Cities",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DuplicateOfOfficialId",
                schema: "platform",
                table: "Cities",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsGovernorate",
                schema: "platform",
                table: "Cities",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "MergedIntoCityId",
                schema: "platform",
                table: "Cities",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                schema: "platform",
                table: "Cities",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameSearch",
                schema: "platform",
                table: "Cities",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "OfficialId",
                schema: "platform",
                table: "Cities",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RawInput",
                schema: "platform",
                table: "Cities",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAtUtc",
                schema: "platform",
                table: "Cities",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedByUserId",
                schema: "platform",
                table: "Cities",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "platform",
                table: "Cities",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "approved");

 // Existing v1 rows: keep searchable until EnsureSeeded rewrites NameSearch.
            migrationBuilder.Sql(
                """
                UPDATE platform."Cities"
                SET "NameSearch" = "NameAr", "Status" = 'approved'
                WHERE COALESCE("NameSearch", '') = '';
                """);


            migrationBuilder.AddColumn<int>(
                name: "UsageCount",
                schema: "platform",
                table: "Cities",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Districts",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CityId = table.Column<Guid>(type: "uuid", nullable: false),
                    NameAr = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    NameSearch = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RawInput = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    MergedIntoDistrictId = table.Column<Guid>(type: "uuid", nullable: true),
                    UsageCount = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Districts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Districts_Cities_CityId",
                        column: x => x.CityId,
                        principalSchema: "platform",
                        principalTable: "Cities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Districts_Districts_MergedIntoDistrictId",
                        column: x => x.MergedIntoDistrictId,
                        principalSchema: "platform",
                        principalTable: "Districts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Regions_AdminAreaId",
                schema: "platform",
                table: "Regions",
                column: "AdminAreaId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Regions_OfficialId",
                schema: "platform",
                table: "Regions",
                column: "OfficialId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cities_MergedIntoCityId",
                schema: "platform",
                table: "Cities",
                column: "MergedIntoCityId");

            migrationBuilder.CreateIndex(
                name: "IX_Cities_NameSearch",
                schema: "platform",
                table: "Cities",
                column: "NameSearch");

            migrationBuilder.CreateIndex(
                name: "IX_Cities_OfficialId",
                schema: "platform",
                table: "Cities",
                column: "OfficialId",
                unique: true,
                filter: "\"OfficialId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Cities_RegionId_IsGovernorate",
                schema: "platform",
                table: "Cities",
                columns: new[] { "RegionId", "IsGovernorate" });

            migrationBuilder.CreateIndex(
                name: "IX_Cities_RegionId_Status",
                schema: "platform",
                table: "Cities",
                columns: new[] { "RegionId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Districts_CityId_Status",
                schema: "platform",
                table: "Districts",
                columns: new[] { "CityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Districts_IsActive",
                schema: "platform",
                table: "Districts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Districts_MergedIntoDistrictId",
                schema: "platform",
                table: "Districts",
                column: "MergedIntoDistrictId");

            migrationBuilder.CreateIndex(
                name: "IX_Districts_NameSearch",
                schema: "platform",
                table: "Districts",
                column: "NameSearch");

            migrationBuilder.AddForeignKey(
                name: "FK_Cities_Cities_MergedIntoCityId",
                schema: "platform",
                table: "Cities",
                column: "MergedIntoCityId",
                principalSchema: "platform",
                principalTable: "Cities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cities_Cities_MergedIntoCityId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropTable(
                name: "Districts",
                schema: "platform");

            migrationBuilder.DropIndex(
                name: "IX_Regions_AdminAreaId",
                schema: "platform",
                table: "Regions");

            migrationBuilder.DropIndex(
                name: "IX_Regions_OfficialId",
                schema: "platform",
                table: "Regions");

            migrationBuilder.DropIndex(
                name: "IX_Cities_MergedIntoCityId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropIndex(
                name: "IX_Cities_NameSearch",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropIndex(
                name: "IX_Cities_OfficialId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropIndex(
                name: "IX_Cities_RegionId_IsGovernorate",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropIndex(
                name: "IX_Cities_RegionId_Status",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "AdminAreaId",
                schema: "platform",
                table: "Regions");

            migrationBuilder.DropColumn(
                name: "OfficialId",
                schema: "platform",
                table: "Regions");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "DuplicateOfOfficialId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "IsGovernorate",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "MergedIntoCityId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "NameEn",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "NameSearch",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "OfficialId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "RawInput",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "ReviewedAtUtc",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "ReviewedByUserId",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "platform",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "UsageCount",
                schema: "platform",
                table: "Cities");

            migrationBuilder.AlterColumn<string>(
                name: "NameAr",
                schema: "platform",
                table: "Cities",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150);

            migrationBuilder.CreateIndex(
                name: "IX_Cities_RegionId_NameAr",
                schema: "platform",
                table: "Cities",
                columns: new[] { "RegionId", "NameAr" },
                unique: true);
        }
    }
}
