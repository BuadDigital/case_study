using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723120000_DropCrmClientProfiles")]
public partial class DropCrmClientProfiles : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "CrmClientProfiles",
            schema: "identity");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CrmClientProfiles",
            schema: "identity",
            columns: table => new
            {
                UserId = table.Column<string>(type: "text", nullable: false),
                AccountRepresentative = table.Column<string>(type: "text", nullable: true),
                Address = table.Column<string>(type: "text", nullable: true),
                ClientStatus = table.Column<int>(type: "integer", nullable: false),
                ClientType = table.Column<int>(type: "integer", nullable: false),
                CommercialRegistration = table.Column<string>(type: "text", nullable: true),
                ContactPerson = table.Column<string>(type: "text", nullable: true),
                ContactPhone = table.Column<string>(type: "text", nullable: true),
                ContactRole = table.Column<string>(type: "text", nullable: true),
                EntityKind = table.Column<int>(type: "integer", nullable: false),
                FullName = table.Column<string>(type: "text", nullable: true),
                NationalId = table.Column<string>(type: "text", nullable: true),
                OrganizationName = table.Column<string>(type: "text", nullable: true),
                Region = table.Column<string>(type: "text", nullable: true),
                Sector = table.Column<string>(type: "text", nullable: true),
                VatRegistration = table.Column<string>(type: "text", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CrmClientProfiles", x => x.UserId);
                table.ForeignKey(
                    name: "FK_CrmClientProfiles_UserProfiles_UserId",
                    column: x => x.UserId,
                    principalSchema: "identity",
                    principalTable: "UserProfiles",
                    principalColumn: "UserId",
                    onDelete: ReferentialAction.Cascade);
            });
    }
}
