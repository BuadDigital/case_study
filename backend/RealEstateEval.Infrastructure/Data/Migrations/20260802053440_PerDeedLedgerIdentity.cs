using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class PerDeedLedgerIdentity : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_InspectorFeeLedgers",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeedId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TransactionId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

 // Backfill identity before enforcing NOT NULL / unique.
            migrationBuilder.Sql("""
                UPDATE case_study."InspectorFeeLedgers" AS l
                SET
                    "Id" = gen_random_uuid(),
                    "UserId" = COALESCE(NULLIF(BTRIM(l."AssigneeId"), ''), ''),
                    "DeedId" = COALESCE(l."PropertyId", l."WorkflowTaskId"),
                    "TransactionId" = COALESCE(
                        (
                            SELECT w."Id"
                            FROM case_study."WorkOrders" AS w
                            WHERE w."PoNumber" = l."PoNumber"
                            LIMIT 1
                        ),
                        l."WorkflowTaskId");
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "Id",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "DeedId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "TransactionId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_InspectorFeeLedgers",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_InspectorFeeLedgers_WorkflowTaskId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                column: "WorkflowTaskId");

            migrationBuilder.CreateIndex(
                name: "UX_InspectorFeeLedgers_Transaction_Deed_User",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                columns: new[] { "TransactionId", "DeedId", "UserId" },
                unique: true);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_InspectorFeeLedgers",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropIndex(
                name: "IX_InspectorFeeLedgers_WorkflowTaskId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropIndex(
                name: "UX_InspectorFeeLedgers_Transaction_Deed_User",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "Id",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "DeedId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "UserId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.AddPrimaryKey(
                name: "PK_InspectorFeeLedgers",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                column: "WorkflowTaskId");
        }
    }
}
