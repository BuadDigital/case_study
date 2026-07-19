using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncKeyEnvelopeModelSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KeyEnvelopes",
                schema: "operations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Court = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Circuit = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    KeysCountLabeled = table.Column<int>(type: "integer", nullable: false),
                    KeysCountActual = table.Column<int>(type: "integer", nullable: false),
                    ReceiptAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PhotoAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ThirdPartyLetterAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContactPhones = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ReceiveScenario = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    FeeGenerated = table.Column<bool>(type: "boolean", nullable: false),
                    FeeAmountSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyEnvelopes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PropertyCourtAccesses",
                schema: "operations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeedNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    RequestNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    HasEnablingLetter = table.Column<bool>(type: "boolean", nullable: false),
                    EnablingLetterAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    HasEvictionNotice = table.Column<bool>(type: "boolean", nullable: false),
                    EvictionNoticeAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    StudyHoldStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ContactPhones = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    UpdatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyCourtAccesses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KeyEnvelopeAssignments",
                schema: "operations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EnvelopeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeedNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ConfirmedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ConfirmedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConfirmedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyEnvelopeAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KeyEnvelopeAssignments_KeyEnvelopes_EnvelopeId",
                        column: x => x.EnvelopeId,
                        principalSchema: "operations",
                        principalTable: "KeyEnvelopes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KeyEnvelopeHandoffs",
                schema: "operations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EnvelopeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    FromParty = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ToParty = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ToUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    LetterNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    LetterAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ConfirmedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ConfirmedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConfirmedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyEnvelopeHandoffs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KeyEnvelopeHandoffs_KeyEnvelopes_EnvelopeId",
                        column: x => x.EnvelopeId,
                        principalSchema: "operations",
                        principalTable: "KeyEnvelopes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KeyEnvelopeTimelineEntries",
                schema: "operations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EnvelopeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ActorUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    PayloadJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyEnvelopeTimelineEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KeyEnvelopeTimelineEntries_KeyEnvelopes_EnvelopeId",
                        column: x => x.EnvelopeId,
                        principalSchema: "operations",
                        principalTable: "KeyEnvelopes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_RequestNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "RequestNumber");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopeAssignments_EnvelopeId",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                column: "EnvelopeId");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopeAssignments_EnvelopeId_DeedNumber",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                columns: new[] { "EnvelopeId", "DeedNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopeHandoffs_EnvelopeId",
                schema: "operations",
                table: "KeyEnvelopeHandoffs",
                column: "EnvelopeId");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopeHandoffs_Status",
                schema: "operations",
                table: "KeyEnvelopeHandoffs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_CreatedAtUtc",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_FeeGenerated",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "FeeGenerated");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_RequestNumber",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "RequestNumber");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_Status",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopeTimelineEntries_EnvelopeId_CreatedAtUtc",
                schema: "operations",
                table: "KeyEnvelopeTimelineEntries",
                columns: new[] { "EnvelopeId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCourtAccesses_PropertyId",
                schema: "operations",
                table: "PropertyCourtAccesses",
                column: "PropertyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCourtAccesses_RequestNumber",
                schema: "operations",
                table: "PropertyCourtAccesses",
                column: "RequestNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyCourtAccesses_StudyHoldStatus",
                schema: "operations",
                table: "PropertyCourtAccesses",
                column: "StudyHoldStatus");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KeyEnvelopeAssignments",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "KeyEnvelopeHandoffs",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "KeyEnvelopeTimelineEntries",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "PropertyCourtAccesses",
                schema: "operations");

            migrationBuilder.DropTable(
                name: "KeyEnvelopes",
                schema: "operations");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_RequestNumber",
                schema: "case_study",
                table: "WorkOrderProperties");
        }
    }
}
