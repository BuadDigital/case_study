using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddOptimisticConcurrencyTokens : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "WorkOrders",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "WorkflowTasks",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "valuation",
                table: "ValuationRequests",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "identity",
                table: "UserProfiles",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "operations",
                table: "PropertyKeyRecords",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "failures",
                table: "PropertyFailures",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "operations",
                table: "PropertyCourtAccesses",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "PartyTaskSubmissions",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "OperationsTasks",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "financial",
                table: "KeyReceiptFeeCharges",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "operations",
                table: "KeyEnvelopes",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "operations",
                table: "KeyEnvelopeHandoffs",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "valuation",
                table: "EvaluatorRecallRecords",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "financial",
                table: "EngineeringBillingStatements",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "case_study",
                table: "CaseStudyForms",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "operations",
                table: "PropertyKeyRecords");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "operations",
                table: "PropertyCourtAccesses");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "PartyTaskSubmissions");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "OperationsTasks");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "financial",
                table: "KeyReceiptFeeCharges");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "operations",
                table: "KeyEnvelopeHandoffs");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "operations",
                table: "KeyEnvelopeAssignments");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "FieldInspectionWorkspaces");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "valuation",
                table: "EvaluatorRecallRecords");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "financial",
                table: "EngineeringBillingStatements");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "financial",
                table: "CourtVisitFeeCharges");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "case_study",
                table: "CaseStudyForms");
        }
    }
}
