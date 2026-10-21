using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    /// <summary>
    /// Decision 2026-10-20: no reference number carries an Arabic prefix. The court-visit
    /// reference «خ.ت-2026-0007» becomes CV-26-0007 (two-digit year like every other reference).
    /// Task display ids (T-2026-0007) stay as printed; new ones take the short year.
    /// </summary>
    [DbContext(typeof(OperationsDbContext))]
    [Migration("20261020070100_CourtVisitReferenceLatin")]
    public partial class CourtVisitReferenceLatin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE operations."OperationsTasks"
                SET "Reference" = regexp_replace("Reference", '^خ\.ت-[0-9]{2}([0-9]{2})-', 'CV-\1-')
                WHERE "Reference" LIKE 'خ.ت-%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE operations."OperationsTasks"
                SET "Reference" = regexp_replace("Reference", '^CV-([0-9]{2})-', 'خ.ت-20\1-')
                WHERE "Reference" LIKE 'CV-%';
                """);
        }
    }
}
