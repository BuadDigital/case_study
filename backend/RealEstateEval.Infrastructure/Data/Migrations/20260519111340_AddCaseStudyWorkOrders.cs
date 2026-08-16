using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddCaseStudyWorkOrders : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CourtCatalogEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    City = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Court = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CircuitsJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourtCatalogEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AssignmentType = table.Column<int>(type: "integer", nullable: false),
                    ReceivedFromEnfathAt = table.Column<DateOnly>(type: "date", nullable: false),
                    ReceivedFromEnfathTime = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    InternalAssignmentAt = table.Column<DateOnly>(type: "date", nullable: false),
                    AssignmentSpecialist = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DueDateAt = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RegisteredByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrders_Users_RegisteredByUserId",
                        column: x => x.RegisteredByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrderProperties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    IdentifierType = table.Column<int>(type: "integer", nullable: false),
                    DeedNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeedDate = table.Column<string>(type: "text", nullable: true),
                    OwnerName = table.Column<string>(type: "text", nullable: true),
                    Restrictions = table.Column<string>(type: "text", nullable: true),
                    BoundariesMatch = table.Column<string>(type: "text", nullable: true),
                    City = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    District = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeedStatus = table.Column<string>(type: "text", nullable: true),
                    Area = table.Column<string>(type: "text", nullable: true),
                    Boundaries = table.Column<string>(type: "text", nullable: true),
                    Court = table.Column<string>(type: "text", nullable: true),
                    Circuit = table.Column<string>(type: "text", nullable: true),
                    Classification = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PropertyType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    AssignmentDocFileName = table.Column<string>(type: "text", nullable: true),
                    RealEstateRegFileName = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrderProperties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrderProperties_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PropertyContacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Phone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyContacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertyContacts_WorkOrderProperties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "WorkOrderProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyContacts_PropertyId",
                table: "PropertyContacts",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_WorkOrderId_DeedNumber",
                table: "WorkOrderProperties",
                columns: new[] { "WorkOrderId", "DeedNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_PoNumber",
                table: "WorkOrders",
                column: "PoNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_RegisteredByUserId",
                table: "WorkOrders",
                column: "RegisteredByUserId");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourtCatalogEntries");

            migrationBuilder.DropTable(
                name: "PropertyContacts");

            migrationBuilder.DropTable(
                name: "WorkOrderProperties");

            migrationBuilder.DropTable(
                name: "WorkOrders");
        }
    }
}
