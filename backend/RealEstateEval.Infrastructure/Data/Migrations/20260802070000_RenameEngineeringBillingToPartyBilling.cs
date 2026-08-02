using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>ج٩ naming: generalized statements are no longer engineering-only.</summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260802070000_RenameEngineeringBillingToPartyBilling")]
public partial class RenameEngineeringBillingToPartyBilling : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameTable(
            name: "EngineeringBillingStatements",
            schema: "financial",
            newName: "PartyBillingStatements",
            newSchema: "financial");

        migrationBuilder.RenameTable(
            name: "EngineeringBillingStatementLines",
            schema: "financial",
            newName: "PartyBillingStatementLines",
            newSchema: "financial");

        migrationBuilder.RenameColumn(
            name: "EngineeringBillingStatementId",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            newName: "PartyBillingStatementId");

        migrationBuilder.RenameIndex(
            name: "IX_InspectorFeeLedgers_EngineeringBillingStatementId",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            newName: "IX_InspectorFeeLedgers_PartyBillingStatementId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameIndex(
            name: "IX_InspectorFeeLedgers_PartyBillingStatementId",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            newName: "IX_InspectorFeeLedgers_EngineeringBillingStatementId");

        migrationBuilder.RenameColumn(
            name: "PartyBillingStatementId",
            schema: "case_study",
            table: "InspectorFeeLedgers",
            newName: "EngineeringBillingStatementId");

        migrationBuilder.RenameTable(
            name: "PartyBillingStatementLines",
            schema: "financial",
            newName: "EngineeringBillingStatementLines",
            newSchema: "financial");

        migrationBuilder.RenameTable(
            name: "PartyBillingStatements",
            schema: "financial",
            newName: "EngineeringBillingStatements",
            newSchema: "financial");
    }
}
