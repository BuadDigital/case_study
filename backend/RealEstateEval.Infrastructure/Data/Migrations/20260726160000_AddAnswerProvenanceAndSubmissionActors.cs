using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Adds answer provenance on case-study forms and actor attribution on party submissions.
/// Additive / nullable — existing rows remain valid with empty provenance.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260726160000_AddAnswerProvenanceAndSubmissionActors")]
public partial class AddAnswerProvenanceAndSubmissionActors : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."CaseStudyForms"
            ADD COLUMN IF NOT EXISTS "AnswerProvenanceJson" jsonb NULL;
            """);

        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."PartyTaskSubmissions"
            ADD COLUMN IF NOT EXISTS "SubmittedByUserId" character varying(450) NULL,
            ADD COLUMN IF NOT EXISTS "SubmittedByName" character varying(256) NULL,
            ADD COLUMN IF NOT EXISTS "AcceptedByUserId" character varying(450) NULL,
            ADD COLUMN IF NOT EXISTS "AcceptedByName" character varying(256) NULL,
            ADD COLUMN IF NOT EXISTS "ReopenedByUserId" character varying(450) NULL,
            ADD COLUMN IF NOT EXISTS "ReopenedByName" character varying(256) NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."CaseStudyForms"
            DROP COLUMN IF EXISTS "AnswerProvenanceJson";
            """);

        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."PartyTaskSubmissions"
            DROP COLUMN IF EXISTS "SubmittedByUserId",
            DROP COLUMN IF EXISTS "SubmittedByName",
            DROP COLUMN IF EXISTS "AcceptedByUserId",
            DROP COLUMN IF EXISTS "AcceptedByName",
            DROP COLUMN IF EXISTS "ReopenedByUserId",
            DROP COLUMN IF EXISTS "ReopenedByName";
            """);
    }
}
