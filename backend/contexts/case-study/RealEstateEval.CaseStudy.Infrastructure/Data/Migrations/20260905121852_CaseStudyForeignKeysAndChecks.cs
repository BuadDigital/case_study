using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    /// <inheritdoc />
    public partial class CaseStudyForeignKeysAndChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clients_IsActive",
                schema: "case_study",
                table: "Clients");

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties"
                    ALTER COLUMN "DeedOwnersJson" TYPE jsonb USING NULLIF("DeedOwnersJson", '')::jsonb;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkOrderProperties_HasStructuresToValue",
                schema: "case_study",
                table: "WorkOrderProperties",
                sql: "\"HasStructuresToValue\" IS NULL OR \"HasStructuresToValue\" IN ('', 'yes', 'no')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkOrderProperties_RestrictionsPresent",
                schema: "case_study",
                table: "WorkOrderProperties",
                sql: "\"RestrictionsPresent\" IS NULL OR \"RestrictionsPresent\" IN ('', 'yes', 'no')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkflowTasks_Kind",
                schema: "case_study",
                table: "WorkflowTasks",
                sql: "\"Kind\" IS NULL OR \"Kind\" IN ('case-study-property', 'government-review', 'valuation-coordination', 'field-inspection', 'property-appraisal', 'engineering-survey', 'court-visit')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkflowTasks_ObstructionPriorPhase",
                schema: "case_study",
                table: "WorkflowTasks",
                sql: "\"ObstructionPriorPhase\" IS NULL OR \"ObstructionPriorPhase\" IN ('enfath', 'bourse', 'distribution', 'case-study', 'obstruction', 'done')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkflowTasks_Phase",
                schema: "case_study",
                table: "WorkflowTasks",
                sql: "\"Phase\" IS NULL OR \"Phase\" IN ('enfath', 'bourse', 'distribution', 'case-study', 'obstruction', 'done')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkflowTasks_Status",
                schema: "case_study",
                table: "WorkflowTasks",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('open', 'completed', 'cancelled', 'blocked')");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyTimelineEntries_PropertyId",
                schema: "case_study",
                table: "PropertyTimelineEntries",
                column: "PropertyId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyTaskSubmissions_Status",
                schema: "case_study",
                table: "PartyTaskSubmissions",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('draft', 'submitted', 'reopened')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_FieldInspectionWorkspaces_Status",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('draft', 'submitted', 'reopened')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_CaseStudyForms_InfathLinkedAssets",
                schema: "case_study",
                table: "CaseStudyForms",
                sql: "\"InfathLinkedAssets\" IS NULL OR \"InfathLinkedAssets\" IN ('', 'yes', 'no')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_CaseStudyForms_Status",
                schema: "case_study",
                table: "CaseStudyForms",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('new', 'draft', 'submitted', 'completed', 'done')");

            // The links below were kept by hand in the repository delete paths until now. Rows whose
            // parent is already gone are what those paths would have removed: child rows of a
            // missing task or property are deleted, optional pointers are cleared.
            migrationBuilder.Sql(
                """
                UPDATE case_study."WorkflowTasks" t SET "PropertyId" = NULL
                WHERE t."PropertyId" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM case_study."WorkOrderProperties" p WHERE p."Id" = t."PropertyId");

                UPDATE case_study."WorkflowTasks" t SET "ParentTaskId" = NULL
                WHERE t."ParentTaskId" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM case_study."WorkflowTasks" parent WHERE parent."Id" = t."ParentTaskId");

                DELETE FROM case_study."FieldInspectionWorkspaces" w
                WHERE NOT EXISTS (SELECT 1 FROM case_study."WorkflowTasks" t WHERE t."Id" = w."WorkflowTaskId")
                   OR NOT EXISTS (SELECT 1 FROM case_study."PartyTaskSubmissions" s WHERE s."Id" = w."PartyTaskSubmissionId");

                DELETE FROM case_study."PartyTaskSubmissions" s
                WHERE NOT EXISTS (SELECT 1 FROM case_study."WorkflowTasks" t WHERE t."Id" = s."WorkflowTaskId");

                DELETE FROM case_study."CaseStudyForms" f
                WHERE NOT EXISTS (SELECT 1 FROM case_study."WorkflowTasks" t WHERE t."Id" = f."TaskId");

                DELETE FROM case_study."PropertyGroupMembers" m
                WHERE NOT EXISTS (SELECT 1 FROM case_study."WorkOrderProperties" p WHERE p."Id" = m."PropertyId");

                DELETE FROM case_study."PropertyTimelineEntries" e
                WHERE NOT EXISTS (SELECT 1 FROM case_study."WorkOrderProperties" p WHERE p."Id" = e."PropertyId");
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_CaseStudyForms_WorkflowTasks_TaskId",
                schema: "case_study",
                table: "CaseStudyForms",
                column: "TaskId",
                principalSchema: "case_study",
                principalTable: "WorkflowTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FieldInspectionWorkspaces_PartyTaskSubmissions_PartyTaskSub~",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "PartyTaskSubmissionId",
                principalSchema: "case_study",
                principalTable: "PartyTaskSubmissions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FieldInspectionWorkspaces_WorkflowTasks_WorkflowTaskId",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "WorkflowTaskId",
                principalSchema: "case_study",
                principalTable: "WorkflowTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PartyTaskSubmissions_WorkflowTasks_WorkflowTaskId",
                schema: "case_study",
                table: "PartyTaskSubmissions",
                column: "WorkflowTaskId",
                principalSchema: "case_study",
                principalTable: "WorkflowTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PropertyGroupMembers_WorkOrderProperties_PropertyId",
                schema: "case_study",
                table: "PropertyGroupMembers",
                column: "PropertyId",
                principalSchema: "case_study",
                principalTable: "WorkOrderProperties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PropertyTimelineEntries_WorkOrderProperties_PropertyId",
                schema: "case_study",
                table: "PropertyTimelineEntries",
                column: "PropertyId",
                principalSchema: "case_study",
                principalTable: "WorkOrderProperties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkflowTasks_WorkOrderProperties_PropertyId",
                schema: "case_study",
                table: "WorkflowTasks",
                column: "PropertyId",
                principalSchema: "case_study",
                principalTable: "WorkOrderProperties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkflowTasks_WorkflowTasks_ParentTaskId",
                schema: "case_study",
                table: "WorkflowTasks",
                column: "ParentTaskId",
                principalSchema: "case_study",
                principalTable: "WorkflowTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CaseStudyForms_WorkflowTasks_TaskId",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.DropForeignKey(
                name: "FK_FieldInspectionWorkspaces_PartyTaskSubmissions_PartyTaskSub~",
                schema: "case_study",
                table: "FieldInspectionWorkspaces");

            migrationBuilder.DropForeignKey(
                name: "FK_FieldInspectionWorkspaces_WorkflowTasks_WorkflowTaskId",
                schema: "case_study",
                table: "FieldInspectionWorkspaces");

            migrationBuilder.DropForeignKey(
                name: "FK_PartyTaskSubmissions_WorkflowTasks_WorkflowTaskId",
                schema: "case_study",
                table: "PartyTaskSubmissions");

            migrationBuilder.DropForeignKey(
                name: "FK_PropertyGroupMembers_WorkOrderProperties_PropertyId",
                schema: "case_study",
                table: "PropertyGroupMembers");

            migrationBuilder.DropForeignKey(
                name: "FK_PropertyTimelineEntries_WorkOrderProperties_PropertyId",
                schema: "case_study",
                table: "PropertyTimelineEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkflowTasks_WorkOrderProperties_PropertyId",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkflowTasks_WorkflowTasks_ParentTaskId",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkOrderProperties_HasStructuresToValue",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkOrderProperties_RestrictionsPresent",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkflowTasks_Kind",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkflowTasks_ObstructionPriorPhase",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkflowTasks_Phase",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkflowTasks_Status",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropIndex(
                name: "IX_PropertyTimelineEntries_PropertyId",
                schema: "case_study",
                table: "PropertyTimelineEntries");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyTaskSubmissions_Status",
                schema: "case_study",
                table: "PartyTaskSubmissions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_FieldInspectionWorkspaces_Status",
                schema: "case_study",
                table: "FieldInspectionWorkspaces");

            migrationBuilder.DropCheckConstraint(
                name: "CK_CaseStudyForms_InfathLinkedAssets",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.DropCheckConstraint(
                name: "CK_CaseStudyForms_Status",
                schema: "case_study",
                table: "CaseStudyForms");

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties"
                    ALTER COLUMN "DeedOwnersJson" TYPE character varying(4000) USING "DeedOwnersJson"::text;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_IsActive",
                schema: "case_study",
                table: "Clients",
                column: "IsActive");
        }
    }
}
