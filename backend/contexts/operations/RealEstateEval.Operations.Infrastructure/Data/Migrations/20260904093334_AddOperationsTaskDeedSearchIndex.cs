using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    /// <summary>
    /// Deed-number search for <c>GET /api/operations-tasks</c>.
    ///
    /// <para>
    /// <c>DeedsJson</c> is a jsonb array of deed numbers. Two index shapes were considered and both
    /// are created, because they answer different halves of the search:
    /// </para>
    /// <list type="bullet">
    /// <item>GIN <c>jsonb_path_ops</c> on the column itself accelerates <c>@&gt;</c> containment,
    /// i.e. an <em>exact</em> deed number (<c>EF.Functions.JsonContains</c>). It cannot help a
    /// substring — <c>jsonb_path_ops</c> only indexes hashed paths of whole values.</item>
    /// <item>GIN <c>gin_trgm_ops</c> on a stored generated text projection of the same column
    /// answers <c>LIKE '%…%'</c>, which is what the screen's <c>t.deeds.join(" ").includes(q)</c>
    /// actually is. A generated tsvector was rejected: tsvector matches whole lexemes (or prefixes
    /// with <c>:*</c>), never an infix, so a partial deed number would miss.</item>
    /// </list>
    ///
    /// <para>
    /// The projection is a column rather than an expression index because EF can only translate a
    /// mapped property; <c>"DeedsJson" #&gt;&gt; '{}'</c> is immutable (unlike <c>::text</c>), so
    /// PostgreSQL accepts it in <c>GENERATED ALWAYS … STORED</c>.
    /// </para>
    ///
    /// <para>
    /// Written as raw SQL, like <c>EnsureOperationsTablesForStandalone</c>: the D2 task tables are
    /// owned by the Operations stream but still physically named in the <c>case_study</c> schema,
    /// and <c>MigrationStreamTests.ContextStreamsOnlyTouchTheirOwnSchemas</c> forbids a
    /// <c>schema:</c> literal for a schema this context does not own.
    /// </para>
    /// </summary>
    public partial class AddOperationsTaskDeedSearchIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE EXTENSION IF NOT EXISTS pg_trgm;

                ALTER TABLE case_study.""OperationsTasks""
                    ADD COLUMN IF NOT EXISTS ""DeedsText"" text
                    GENERATED ALWAYS AS (""DeedsJson"" #>> '{}') STORED;

                CREATE INDEX IF NOT EXISTS ""IX_OperationsTasks_DeedsJson""
                    ON case_study.""OperationsTasks"" USING gin (""DeedsJson"" jsonb_path_ops);

                CREATE INDEX IF NOT EXISTS ""IX_OperationsTasks_DeedsText_Trgm""
                    ON case_study.""OperationsTasks"" USING gin (""DeedsText"" gin_trgm_ops);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // pg_trgm is left installed: dropping a database-wide extension on the way down could
            // break anything else that came to rely on it.
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS case_study.""IX_OperationsTasks_DeedsText_Trgm"";
                DROP INDEX IF EXISTS case_study.""IX_OperationsTasks_DeedsJson"";
                ALTER TABLE case_study.""OperationsTasks"" DROP COLUMN IF EXISTS ""DeedsText"";
            ");
        }
    }
}
