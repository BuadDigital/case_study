using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts.Failures.Migrations
{
    /// <summary>
    /// Adds «أخرى» — a category and its one problem type, id <c>other</c> — to the failure types catalog
    /// already saved (Omar 2026-11-12). The catalog is one jsonb row the settings screen edits, so the
    /// seed alone never reaches a database that has it.
    /// How it works: appends the category and the type after the last order of each list.
    /// Edge cases: a catalog that already has the type is left alone (the migration can run twice);
    /// a database with no catalog row yet gets «أخرى» from the seed; the schema does not change.
    /// </summary>
    public partial class AddOtherFailureType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE failures."FailureTypesCatalogConfigs" AS cfg
                SET "CatalogJson" = jsonb_set(
                        jsonb_set(
                            cfg."CatalogJson",
                            '{categories}',
                            CASE
                                WHEN COALESCE(cfg."CatalogJson" -> 'categories', '[]'::jsonb) @> '[{"id": "other"}]'::jsonb
                                    THEN cfg."CatalogJson" -> 'categories'
                                ELSE COALESCE(cfg."CatalogJson" -> 'categories', '[]'::jsonb) || jsonb_build_array(
                                    jsonb_build_object(
                                        'id', 'other',
                                        'label', 'أخرى',
                                        'order', (
                                            SELECT COALESCE(MAX((c ->> 'order')::numeric), 0)::int + 1
                                            FROM jsonb_array_elements(COALESCE(cfg."CatalogJson" -> 'categories', '[]'::jsonb)) AS c)))
                            END,
                            true),
                        '{problemTypes}',
                        COALESCE(cfg."CatalogJson" -> 'problemTypes', '[]'::jsonb) || jsonb_build_array(
                            jsonb_build_object(
                                'id', 'other',
                                'categoryId', 'other',
                                'label', 'أخرى',
                                'description', 'تعذّر لا تذكره القائمة — اكتب سببه',
                                'order', (
                                    SELECT COALESCE(MAX((t ->> 'order')::numeric), 0)::int + 1
                                    FROM jsonb_array_elements(COALESCE(cfg."CatalogJson" -> 'problemTypes', '[]'::jsonb)) AS t))),
                        true),
                    "UpdatedAtUtc" = now()
                WHERE NOT COALESCE(cfg."CatalogJson" -> 'problemTypes', '[]'::jsonb) @> '[{"id": "other"}]'::jsonb;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE failures."FailureTypesCatalogConfigs" AS cfg
                SET "CatalogJson" = jsonb_set(
                        jsonb_set(
                            cfg."CatalogJson",
                            '{categories}',
                            COALESCE((
                                SELECT jsonb_agg(c ORDER BY ord)
                                FROM jsonb_array_elements(COALESCE(cfg."CatalogJson" -> 'categories', '[]'::jsonb)) WITH ORDINALITY AS x(c, ord)
                                WHERE c ->> 'id' <> 'other'), '[]'::jsonb),
                            true),
                        '{problemTypes}',
                        COALESCE((
                            SELECT jsonb_agg(t ORDER BY ord)
                            FROM jsonb_array_elements(COALESCE(cfg."CatalogJson" -> 'problemTypes', '[]'::jsonb)) WITH ORDINALITY AS x(t, ord)
                            WHERE t ->> 'id' <> 'other'), '[]'::jsonb),
                        true),
                    "UpdatedAtUtc" = now();
                """);
        }
    }
}
