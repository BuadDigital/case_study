using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    /// <inheritdoc />
    public partial class AddInspectedPropertyType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InspectedPropertyType",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE case_study."WorkOrderProperties" AS p
                SET "InspectedPropertyType" = latest."AssetSubject"
                FROM (
                    SELECT DISTINCT ON (t."PropertyId")
                        t."PropertyId",
                        s."PayloadJson" #>> '{featureValues,assetSubject}' AS "AssetSubject"
                    FROM case_study."WorkflowTasks" AS t
                    INNER JOIN case_study."PartyTaskSubmissions" AS s
                        ON s."WorkflowTaskId" = t."Id"
                    WHERE t."Kind" = 'field-inspection'
                      AND s."Status" = 'submitted'
                      AND NULLIF(BTRIM(
                          s."PayloadJson" #>> '{featureValues,assetSubject}'), '') IS NOT NULL
                    ORDER BY t."PropertyId", s."SubmittedAtUtc" DESC NULLS LAST
                ) AS latest
                WHERE p."Id" = latest."PropertyId";

                UPDATE case_study."WorkOrderProperties"
                SET "HasStructuresToValue" = 'no'
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(
                    COALESCE("InspectedPropertyType", ''),
                    'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ٱ', 'ا') LIKE '%ارض%';

                DELETE FROM case_study."BuildingInventoryLines" AS lines
                USING case_study."WorkOrderProperties" AS p
                WHERE lines."PropertyId" = p."Id"
                  AND REPLACE(REPLACE(REPLACE(REPLACE(
                    COALESCE(p."InspectedPropertyType", ''),
                    'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ٱ', 'ا') LIKE '%ارض%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InspectedPropertyType",
                schema: "case_study",
                table: "WorkOrderProperties");
        }
    }
}
