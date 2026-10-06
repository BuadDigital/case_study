using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// The specialist's stored «نموذج الدراسة» becomes «تقرير دراسة الحالة»: the table
    /// CaseStudyForms → CaseStudyReports, the flag IsPartyForm → IsPartyContribution (a party's
    /// rows are its contribution to the report), and the status «submitted» → «issued». The old
    /// «completed» / «done» values were never written by the code but the CHECK allowed them; they
    /// fold into «issued» (the code only ever treated «submitted» as terminal). Hand-written as
    /// renames — the scaffold would drop and re-create the table and lose every row.
    /// </summary>
    public partial class RenameCaseStudyFormsToReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE case_study."CaseStudyForms" DROP CONSTRAINT "CK_CaseStudyForms_Status";
                UPDATE case_study."CaseStudyForms" SET "Status" = 'issued'
                    WHERE "Status" IN ('submitted', 'completed', 'done');
                ALTER TABLE case_study."CaseStudyForms" RENAME TO "CaseStudyReports";
                ALTER TABLE case_study."CaseStudyReports" RENAME COLUMN "IsPartyForm" TO "IsPartyContribution";
                ALTER TABLE case_study."CaseStudyReports" RENAME CONSTRAINT "PK_CaseStudyForms" TO "PK_CaseStudyReports";
                ALTER TABLE case_study."CaseStudyReports"
                    RENAME CONSTRAINT "FK_CaseStudyForms_WorkflowTasks_TaskId" TO "FK_CaseStudyReports_WorkflowTasks_TaskId";
                ALTER TABLE case_study."CaseStudyReports"
                    RENAME CONSTRAINT "CK_CaseStudyForms_InfathLinkedAssets" TO "CK_CaseStudyReports_InfathLinkedAssets";
                ALTER INDEX case_study."IX_CaseStudyForms_TaskId_IsPartyForm"
                    RENAME TO "IX_CaseStudyReports_TaskId_IsPartyContribution";
                ALTER TABLE case_study."CaseStudyReports" ADD CONSTRAINT "CK_CaseStudyReports_Status"
                    CHECK ("Status" IS NULL OR "Status" IN ('new', 'draft', 'issued'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE case_study."CaseStudyReports" DROP CONSTRAINT "CK_CaseStudyReports_Status";
                UPDATE case_study."CaseStudyReports" SET "Status" = 'submitted' WHERE "Status" = 'issued';
                ALTER INDEX case_study."IX_CaseStudyReports_TaskId_IsPartyContribution"
                    RENAME TO "IX_CaseStudyForms_TaskId_IsPartyForm";
                ALTER TABLE case_study."CaseStudyReports"
                    RENAME CONSTRAINT "CK_CaseStudyReports_InfathLinkedAssets" TO "CK_CaseStudyForms_InfathLinkedAssets";
                ALTER TABLE case_study."CaseStudyReports"
                    RENAME CONSTRAINT "FK_CaseStudyReports_WorkflowTasks_TaskId" TO "FK_CaseStudyForms_WorkflowTasks_TaskId";
                ALTER TABLE case_study."CaseStudyReports" RENAME CONSTRAINT "PK_CaseStudyReports" TO "PK_CaseStudyForms";
                ALTER TABLE case_study."CaseStudyReports" RENAME COLUMN "IsPartyContribution" TO "IsPartyForm";
                ALTER TABLE case_study."CaseStudyReports" RENAME TO "CaseStudyForms";
                ALTER TABLE case_study."CaseStudyForms" ADD CONSTRAINT "CK_CaseStudyForms_Status"
                    CHECK ("Status" IS NULL OR "Status" IN ('new', 'draft', 'submitted', 'completed', 'done'));
                """);
        }
    }
}
