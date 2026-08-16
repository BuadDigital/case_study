using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260816140000_AddPropertyGroups")]
public partial class AddPropertyGroups : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "PropertyGroups",
            schema: "case_study",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PropertyGroups", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "PropertyGroupMembers",
            schema: "case_study",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                LinkedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                LinkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                SuggestionSignals = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                UnlinkReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                UnlinkedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                UnlinkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PropertyGroupMembers", x => x.Id);
                table.ForeignKey(
                    name: "FK_PropertyGroupMembers_PropertyGroups_GroupId",
                    column: x => x.GroupId,
                    principalSchema: "case_study",
                    principalTable: "PropertyGroups",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_PropertyGroupMembers_GroupId",
            schema: "case_study",
            table: "PropertyGroupMembers",
            column: "GroupId");

        migrationBuilder.CreateIndex(
            name: "IX_PropertyGroupMembers_PropertyId_IsActive",
            schema: "case_study",
            table: "PropertyGroupMembers",
            columns: ["PropertyId", "IsActive"]);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "PropertyGroupMembers",
            schema: "case_study");

        migrationBuilder.DropTable(
            name: "PropertyGroups",
            schema: "case_study");
    }
}
