using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>
/// Soft-retire open legacy government-review workflow tasks and their party submissions.
/// Historical completed rows and fee ledgers are left intact.
/// </summary>
[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260810090000_RetireOpenGovernmentReviewWorkflow")]
public partial class RetireOpenGovernmentReviewWorkflow : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE case_study."WorkflowTasks"
            SET "Status" = 'cancelled',
                "UpdatedAtUtc" = NOW() AT TIME ZONE 'utc'
            WHERE "Kind" = 'government-review'
              AND "Status" IN ('open', 'blocked');
            """);
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
 // Irreversible data retirement — no-op.
    }
}
