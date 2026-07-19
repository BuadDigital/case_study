using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCourtsEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CircuitId",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CourtId",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Courts",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Region = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    City = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CourtCircuits",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CourtId = table.Column<Guid>(type: "uuid", nullable: false),
                    CircuitNo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CircuitName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourtCircuits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CourtCircuits_Courts_CourtId",
                        column: x => x.CourtId,
                        principalSchema: "platform",
                        principalTable: "Courts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_CircuitId",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "CircuitId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_CourtId",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "CourtId");

            migrationBuilder.CreateIndex(
                name: "IX_CourtCircuits_CourtId_CircuitNo",
                schema: "platform",
                table: "CourtCircuits",
                columns: new[] { "CourtId", "CircuitNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourtCircuits_IsActive",
                schema: "platform",
                table: "CourtCircuits",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Courts_IsActive",
                schema: "platform",
                table: "Courts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Courts_Name_City",
                schema: "platform",
                table: "Courts",
                columns: new[] { "Name", "City" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Courts_Region_City",
                schema: "platform",
                table: "Courts",
                columns: new[] { "Region", "City" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourtCircuits",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "Courts",
                schema: "platform");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_CircuitId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_CourtId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "CircuitId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "CourtId",
                schema: "case_study",
                table: "WorkOrderProperties");
        }
    }
}
