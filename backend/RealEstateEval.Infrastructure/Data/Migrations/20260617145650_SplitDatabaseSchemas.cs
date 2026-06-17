using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SplitDatabaseSchemas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "case_study");

            migrationBuilder.EnsureSchema(
                name: "platform");

            migrationBuilder.EnsureSchema(
                name: "identity");

            migrationBuilder.EnsureSchema(
                name: "valuation");

            migrationBuilder.EnsureSchema(
                name: "failures");

            migrationBuilder.EnsureSchema(
                name: "attachments");

            migrationBuilder.EnsureSchema(
                name: "financial");

            migrationBuilder.EnsureSchema(
                name: "messaging");

            migrationBuilder.EnsureSchema(
                name: "operations");

            migrationBuilder.RenameTable(
                name: "WorkOrders",
                newName: "WorkOrders",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "WorkOrderProperties",
                newName: "WorkOrderProperties",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "WorkflowTasks",
                newName: "WorkflowTasks",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "ValuationRequests",
                newName: "ValuationRequests",
                newSchema: "valuation");

            migrationBuilder.RenameTable(
                name: "UserTokens",
                newName: "UserTokens",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "Users",
                newName: "Users",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "UserRoles",
                newName: "UserRoles",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "UserProfiles",
                newName: "UserProfiles",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "UserLogins",
                newName: "UserLogins",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "UserClaims",
                newName: "UserClaims",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "SurveyOffices",
                newName: "SurveyOffices",
                newSchema: "operations");

            migrationBuilder.RenameTable(
                name: "Roles",
                newName: "Roles",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "RoleClaims",
                newName: "RoleClaims",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "PropertyKeyRecords",
                newName: "PropertyKeyRecords",
                newSchema: "operations");

            migrationBuilder.RenameTable(
                name: "PropertyFailures",
                newName: "PropertyFailures",
                newSchema: "failures");

            migrationBuilder.RenameTable(
                name: "PropertyContacts",
                newName: "PropertyContacts",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "ProcServiceProviderProfiles",
                newName: "ProcServiceProviderProfiles",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "PoIntakeDrafts",
                newName: "PoIntakeDrafts",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "PartyTaskSubmissions",
                newName: "PartyTaskSubmissions",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "OutboxMessages",
                newName: "OutboxMessages",
                newSchema: "messaging");

            migrationBuilder.RenameTable(
                name: "InternalDelegationLetterSets",
                newName: "InternalDelegationLetterSets",
                newSchema: "case_study");

            migrationBuilder.RenameTable(
                name: "HrEmployeeProfiles",
                newName: "HrEmployeeProfiles",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "FinancialReportConfigs",
                newName: "FinancialReportConfigs",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "FileAttachments",
                newName: "FileAttachments",
                newSchema: "attachments");

            migrationBuilder.RenameTable(
                name: "FieldDictionaryConfigs",
                newName: "FieldDictionaryConfigs",
                newSchema: "platform");

            migrationBuilder.RenameTable(
                name: "FailureTypesCatalogConfigs",
                newName: "FailureTypesCatalogConfigs",
                newSchema: "failures");

            migrationBuilder.RenameTable(
                name: "EvaluatorRecallRecords",
                newName: "EvaluatorRecallRecords",
                newSchema: "valuation");

            migrationBuilder.RenameTable(
                name: "CustomAssignedScreenUsers",
                newName: "CustomAssignedScreenUsers",
                newSchema: "platform");

            migrationBuilder.RenameTable(
                name: "CustomAssignedScreens",
                newName: "CustomAssignedScreens",
                newSchema: "platform");

            migrationBuilder.RenameTable(
                name: "CrmClientProfiles",
                newName: "CrmClientProfiles",
                newSchema: "identity");

            migrationBuilder.RenameTable(
                name: "CourtCatalogEntries",
                newName: "CourtCatalogEntries",
                newSchema: "platform");

            migrationBuilder.RenameTable(
                name: "CaseStudyInfoRolesConfigs",
                newName: "CaseStudyInfoRolesConfigs",
                newSchema: "platform");

            migrationBuilder.RenameTable(
                name: "CaseStudyForms",
                newName: "CaseStudyForms",
                newSchema: "case_study");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "WorkOrders",
                schema: "case_study",
                newName: "WorkOrders");

            migrationBuilder.RenameTable(
                name: "WorkOrderProperties",
                schema: "case_study",
                newName: "WorkOrderProperties");

            migrationBuilder.RenameTable(
                name: "WorkflowTasks",
                schema: "case_study",
                newName: "WorkflowTasks");

            migrationBuilder.RenameTable(
                name: "ValuationRequests",
                schema: "valuation",
                newName: "ValuationRequests");

            migrationBuilder.RenameTable(
                name: "UserTokens",
                schema: "identity",
                newName: "UserTokens");

            migrationBuilder.RenameTable(
                name: "Users",
                schema: "identity",
                newName: "Users");

            migrationBuilder.RenameTable(
                name: "UserRoles",
                schema: "identity",
                newName: "UserRoles");

            migrationBuilder.RenameTable(
                name: "UserProfiles",
                schema: "identity",
                newName: "UserProfiles");

            migrationBuilder.RenameTable(
                name: "UserLogins",
                schema: "identity",
                newName: "UserLogins");

            migrationBuilder.RenameTable(
                name: "UserClaims",
                schema: "identity",
                newName: "UserClaims");

            migrationBuilder.RenameTable(
                name: "SurveyOffices",
                schema: "operations",
                newName: "SurveyOffices");

            migrationBuilder.RenameTable(
                name: "Roles",
                schema: "identity",
                newName: "Roles");

            migrationBuilder.RenameTable(
                name: "RoleClaims",
                schema: "identity",
                newName: "RoleClaims");

            migrationBuilder.RenameTable(
                name: "PropertyKeyRecords",
                schema: "operations",
                newName: "PropertyKeyRecords");

            migrationBuilder.RenameTable(
                name: "PropertyFailures",
                schema: "failures",
                newName: "PropertyFailures");

            migrationBuilder.RenameTable(
                name: "PropertyContacts",
                schema: "case_study",
                newName: "PropertyContacts");

            migrationBuilder.RenameTable(
                name: "ProcServiceProviderProfiles",
                schema: "identity",
                newName: "ProcServiceProviderProfiles");

            migrationBuilder.RenameTable(
                name: "PoIntakeDrafts",
                schema: "case_study",
                newName: "PoIntakeDrafts");

            migrationBuilder.RenameTable(
                name: "PartyTaskSubmissions",
                schema: "case_study",
                newName: "PartyTaskSubmissions");

            migrationBuilder.RenameTable(
                name: "OutboxMessages",
                schema: "messaging",
                newName: "OutboxMessages");

            migrationBuilder.RenameTable(
                name: "InternalDelegationLetterSets",
                schema: "case_study",
                newName: "InternalDelegationLetterSets");

            migrationBuilder.RenameTable(
                name: "HrEmployeeProfiles",
                schema: "identity",
                newName: "HrEmployeeProfiles");

            migrationBuilder.RenameTable(
                name: "FinancialReportConfigs",
                schema: "financial",
                newName: "FinancialReportConfigs");

            migrationBuilder.RenameTable(
                name: "FileAttachments",
                schema: "attachments",
                newName: "FileAttachments");

            migrationBuilder.RenameTable(
                name: "FieldDictionaryConfigs",
                schema: "platform",
                newName: "FieldDictionaryConfigs");

            migrationBuilder.RenameTable(
                name: "FailureTypesCatalogConfigs",
                schema: "failures",
                newName: "FailureTypesCatalogConfigs");

            migrationBuilder.RenameTable(
                name: "EvaluatorRecallRecords",
                schema: "valuation",
                newName: "EvaluatorRecallRecords");

            migrationBuilder.RenameTable(
                name: "CustomAssignedScreenUsers",
                schema: "platform",
                newName: "CustomAssignedScreenUsers");

            migrationBuilder.RenameTable(
                name: "CustomAssignedScreens",
                schema: "platform",
                newName: "CustomAssignedScreens");

            migrationBuilder.RenameTable(
                name: "CrmClientProfiles",
                schema: "identity",
                newName: "CrmClientProfiles");

            migrationBuilder.RenameTable(
                name: "CourtCatalogEntries",
                schema: "platform",
                newName: "CourtCatalogEntries");

            migrationBuilder.RenameTable(
                name: "CaseStudyInfoRolesConfigs",
                schema: "platform",
                newName: "CaseStudyInfoRolesConfigs");

            migrationBuilder.RenameTable(
                name: "CaseStudyForms",
                schema: "case_study",
                newName: "CaseStudyForms");
        }
    }
}
