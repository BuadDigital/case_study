using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    /// <inheritdoc />
    public partial class PromoteSpecialistReportExtrasColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InfathDepositCertificateName",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InfathDepositCode",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrintAttachmentKeysJson",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SearchScopeNotes",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SpecialistEsgJson",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SpecialistFinishingLevel",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            // Backfill first-class columns from the legacy specialist extras bag.
            migrationBuilder.Sql(
                """
                UPDATE case_study."WorkOrderProperties"
                SET
                  "SpecialistFinishingLevel" = NULLIF(LOWER(TRIM("SpecialistReportExtrasJson"->>'finishing')), ''),
                  "SearchScopeNotes" = LEFT(NULLIF(TRIM("SpecialistReportExtrasJson"->>'searchScopeNotes'), ''), 4000),
                  "PrintAttachmentKeysJson" = CASE
                    WHEN jsonb_typeof("SpecialistReportExtrasJson"->'printKeys') = 'array'
                    THEN "SpecialistReportExtrasJson"->'printKeys'
                    ELSE NULL
                  END,
                  "InfathDepositCode" = LEFT(
                    NULLIF(TRIM("SpecialistReportExtrasJson"#>>'{infathDeposit,depositCode}'), ''),
                    128),
                  "InfathDepositCertificateName" = LEFT(
                    NULLIF(TRIM("SpecialistReportExtrasJson"#>>'{infathDeposit,depositCertificateName}'), ''),
                    512),
                  "SpecialistEsgJson" = CASE
                    WHEN jsonb_typeof("SpecialistReportExtrasJson"->'esg') = 'object'
                    THEN "SpecialistReportExtrasJson"->'esg'
                    ELSE NULL
                  END
                WHERE "SpecialistReportExtrasJson" IS NOT NULL
                  AND jsonb_typeof("SpecialistReportExtrasJson") = 'object';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InfathDepositCertificateName",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "InfathDepositCode",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "PrintAttachmentKeysJson",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "SearchScopeNotes",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "SpecialistEsgJson",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "SpecialistFinishingLevel",
                schema: "case_study",
                table: "WorkOrderProperties");
        }
    }
}
