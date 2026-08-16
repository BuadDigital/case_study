using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class DropUnusedAuditFields : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkOrders_Users_RegisteredByUserId",
                table: "WorkOrders");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_RegisteredByUserId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "InternalAssignmentAt",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "RegisteredByUserId",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "RegistrationPayloadJson",
                table: "UserProfiles");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "InternalAssignmentAt",
                table: "WorkOrders",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegisteredByUserId",
                table: "WorkOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegistrationPayloadJson",
                table: "UserProfiles",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_RegisteredByUserId",
                table: "WorkOrders",
                column: "RegisteredByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkOrders_Users_RegisteredByUserId",
                table: "WorkOrders",
                column: "RegisteredByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
