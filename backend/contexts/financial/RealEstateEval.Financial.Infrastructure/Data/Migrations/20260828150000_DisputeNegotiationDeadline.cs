using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    [DbContext(typeof(FinancialDbContext))]
    [Migration("20260828150000_DisputeNegotiationDeadline")]
    public partial class DisputeNegotiationDeadline : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // E6: مهلة التفاوض تُختم عند دخول «معترض» + سجل مراحل الإشعار المرسلة.
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers"
                ADD COLUMN IF NOT EXISTS "DisputeDeadlineUtc" timestamp with time zone NULL;

                ALTER TABLE case_study."InspectorFeeLedgers"
                ADD COLUMN IF NOT EXISTS "DisputeNotifiedStages" character varying(128) NULL;
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers"
                DROP COLUMN IF EXISTS "DisputeDeadlineUtc";

                ALTER TABLE case_study."InspectorFeeLedgers"
                DROP COLUMN IF EXISTS "DisputeNotifiedStages";
                """);
        }
    }
}
