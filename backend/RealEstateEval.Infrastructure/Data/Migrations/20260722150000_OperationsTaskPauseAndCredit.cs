using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260722150000_OperationsTaskPauseAndCredit")]
public partial class OperationsTaskPauseAndCredit : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PauseReason",
            schema: "case_study",
            table: "OperationsTasks",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "PausedAtUtc",
            schema: "case_study",
            table: "OperationsTasks",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "PauseOverLimitRemindedAtUtc",
            schema: "case_study",
            table: "OperationsTasks",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "OriginalAssigneeId",
            schema: "case_study",
            table: "OperationsTasks",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "OriginalAssigneeName",
            schema: "case_study",
            table: "OperationsTasks",
            type: "character varying(256)",
            maxLength: 256,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "CreditAssigneeId",
            schema: "case_study",
            table: "OperationsTasks",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "CreditAssigneeName",
            schema: "case_study",
            table: "OperationsTasks",
            type: "character varying(256)",
            maxLength: 256,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PauseReason", schema: "case_study", table: "OperationsTasks");
        migrationBuilder.DropColumn(name: "PausedAtUtc", schema: "case_study", table: "OperationsTasks");
        migrationBuilder.DropColumn(name: "PauseOverLimitRemindedAtUtc", schema: "case_study", table: "OperationsTasks");
        migrationBuilder.DropColumn(name: "OriginalAssigneeId", schema: "case_study", table: "OperationsTasks");
        migrationBuilder.DropColumn(name: "OriginalAssigneeName", schema: "case_study", table: "OperationsTasks");
        migrationBuilder.DropColumn(name: "CreditAssigneeId", schema: "case_study", table: "OperationsTasks");
        migrationBuilder.DropColumn(name: "CreditAssigneeName", schema: "case_study", table: "OperationsTasks");
    }
}
