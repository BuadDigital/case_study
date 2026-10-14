using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// The PO list buckets (completed / ready_for_enfaz / active) and its counters now filter on
    /// the Enfaz handover stamp — give the column the index the correlated sub-queries read.
    /// </summary>
    [DbContext(typeof(CaseStudyDbContext))]
    [Migration("20261013090000_IndexEnfazHandoverAt")]
    public partial class IndexEnfazHandoverAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_EnfazHandoverAtUtc"
                ON case_study."WorkOrderProperties" ("EnfazHandoverAtUtc");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS case_study."IX_WorkOrderProperties_EnfazHandoverAtUtc";
                """);
        }
    }
}
