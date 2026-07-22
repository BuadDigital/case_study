using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260722140000_CourtVisitOutcomeAndEnvelopeTaskLink")]
public partial class CourtVisitOutcomeAndEnvelopeTaskLink : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CourtVisitResultJson",
            schema: "case_study",
            table: "OperationsTasks",
            type: "jsonb",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "OperationsTaskId",
            schema: "operations",
            table: "KeyEnvelopes",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_KeyEnvelopes_OperationsTaskId",
            schema: "operations",
            table: "KeyEnvelopes",
            column: "OperationsTaskId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_KeyEnvelopes_OperationsTaskId",
            schema: "operations",
            table: "KeyEnvelopes");

        migrationBuilder.DropColumn(
            name: "OperationsTaskId",
            schema: "operations",
            table: "KeyEnvelopes");

        migrationBuilder.DropColumn(
            name: "CourtVisitResultJson",
            schema: "case_study",
            table: "OperationsTasks");
    }
}
