using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// «مستند ذو قيمة»: the appraiser's use of each valued document (approach indicator or an
/// amount added after the liquidation discount), and reconciliation kinds wide enough for the
/// document indicators («doc:{attachmentId:N}»).
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260928100000_ValueDocumentUses")]
public partial class ValueDocumentUses : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "ApproachKind",
            schema: "valuation",
            table: "ValuationReconciliationMethodLines",
            type: "character varying(64)",
            maxLength: 64,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(32)",
            oldMaxLength: 32);

        migrationBuilder.CreateTable(
            name: "ValuationValueDocumentUses",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                AttachmentId = table.Column<Guid>(type: "uuid", nullable: false),
                DocumentLabel = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                Effect = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                ApproachKey = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                MethodName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationValueDocumentUses", x => x.Id);
                table.CheckConstraint("CK_ValuationValueDocumentUses_ApproachKey", "\"ApproachKey\" IS NULL OR \"ApproachKey\" IN ('market', 'cost', 'income')");
                table.CheckConstraint("CK_ValuationValueDocumentUses_Effect", "\"Effect\" IS NULL OR \"Effect\" IN ('indicator', 'addition')");
                table.CheckConstraint("CK_ValuationValueDocumentUses_Value_Positive", "\"Value\" > 0");
                table.ForeignKey(
                    name: "FK_ValuationValueDocumentUses_ValuationRequests_ValuationRequestId",
                    column: x => x.ValuationRequestId,
                    principalSchema: "valuation",
                    principalTable: "ValuationRequests",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationValueDocumentUses_ValuationRequestId_AttachmentId",
            schema: "valuation",
            table: "ValuationValueDocumentUses",
            columns: new[] { "ValuationRequestId", "AttachmentId" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ValuationValueDocumentUses",
            schema: "valuation");

        migrationBuilder.AlterColumn<string>(
            name: "ApproachKind",
            schema: "valuation",
            table: "ValuationReconciliationMethodLines",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(64)",
            oldMaxLength: 64);
    }
}
