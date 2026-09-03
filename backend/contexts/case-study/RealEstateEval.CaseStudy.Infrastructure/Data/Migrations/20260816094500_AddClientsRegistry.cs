using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>Clients registry + link work order to client and report users.</summary>
[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260816094500_AddClientsRegistry")]
public partial class AddClientsRegistry : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Clients",
            schema: "case_study",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                NameAr = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                NameEn = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                IdentityNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                Phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Clients", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Clients_IsActive",
            schema: "case_study",
            table: "Clients",
            column: "IsActive");

        migrationBuilder.CreateIndex(
            name: "IX_Clients_NameAr",
            schema: "case_study",
            table: "Clients",
            column: "NameAr");

        migrationBuilder.AddColumn<Guid>(
            name: "ClientId",
            schema: "case_study",
            table: "WorkOrders",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReportUserClientIdsJson",
            schema: "case_study",
            table: "WorkOrders",
            type: "jsonb",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_WorkOrders_ClientId",
            schema: "case_study",
            table: "WorkOrders",
            column: "ClientId");

        migrationBuilder.AddForeignKey(
            name: "FK_WorkOrders_Clients_ClientId",
            schema: "case_study",
            table: "WorkOrders",
            column: "ClientId",
            principalSchema: "case_study",
            principalTable: "Clients",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.Sql(
            """
            INSERT INTO case_study."Clients" ("Id", "NameAr", "NameEn", "IdentityNumber", "Phone", "Email", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES (
              'a1000001-0000-4000-8000-000000000001',
              'مركز الإسناد والتصفية (إنفاذ)',
              'Assignment and Liquidation Center (Infath)',
              NULL, NULL, NULL, TRUE,
              NOW() AT TIME ZONE 'utc',
              NOW() AT TIME ZONE 'utc'
            )
            ON CONFLICT ("Id") DO NOTHING;
            """);

        migrationBuilder.Sql(
            """
            UPDATE case_study."WorkOrders"
            SET "ClientId" = 'a1000001-0000-4000-8000-000000000001'
            WHERE "ClientId" IS NULL;
            """);
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_WorkOrders_Clients_ClientId",
            schema: "case_study",
            table: "WorkOrders");

        migrationBuilder.DropIndex(
            name: "IX_WorkOrders_ClientId",
            schema: "case_study",
            table: "WorkOrders");

        migrationBuilder.DropColumn(
            name: "ReportUserClientIdsJson",
            schema: "case_study",
            table: "WorkOrders");

        migrationBuilder.DropColumn(
            name: "ClientId",
            schema: "case_study",
            table: "WorkOrders");

        migrationBuilder.DropTable(
            name: "Clients",
            schema: "case_study");
    }
}
