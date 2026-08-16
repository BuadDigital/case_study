using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class PoWorkflowRefactor : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateOnly>(
                name: "InternalAssignmentAt",
                table: "WorkOrders",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AddColumn<string>(
                name: "AssignmentSpecialistEmail",
                table: "WorkOrders",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateOnly>(
                name: "PromulgationDate",
                table: "WorkOrders",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "BoundariesAvailability",
                table: "WorkOrderProperties",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BoundariesExternalDocName",
                table: "WorkOrderProperties",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "BourseDataCompleted",
                table: "WorkOrderProperties",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DelegationLetterFileName",
                table: "WorkOrderProperties",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OtherDocumentFileNames",
                table: "WorkOrderProperties",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RestrictionsPresent",
                table: "WorkOrderProperties",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaskNumber",
                table: "WorkOrderProperties",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "WorkOrders"
                SET "PromulgationDate" = "ReceivedFromEnfathAt"
                """);

            migrationBuilder.Sql(
                """
                UPDATE "WorkOrderProperties"
                SET "BourseDataCompleted" = true
                WHERE COALESCE(TRIM("City"), '') <> ''
                  AND COALESCE(TRIM("Classification"), '') <> ''
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignmentSpecialistEmail",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "PromulgationDate",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "BoundariesAvailability",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "BoundariesExternalDocName",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "BourseDataCompleted",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "DelegationLetterFileName",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "OtherDocumentFileNames",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "RestrictionsPresent",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "TaskNumber",
                table: "WorkOrderProperties");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "InternalAssignmentAt",
                table: "WorkOrders",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1),
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);
        }
    }
}
