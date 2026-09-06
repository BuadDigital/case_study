using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    /// <inheritdoc />
    public partial class UpdatedAtLengthsAndJsonb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "UninspectedUnitsJson" TYPE jsonb USING NULLIF("UninspectedUnitsJson", '')::jsonb;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "RealEstateRegFileName" TYPE character varying(512);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "OwnerName" TYPE character varying(256);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "DeedStatus" TYPE character varying(64);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "DeedOwnershipFileName" TYPE character varying(512);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "DeedDate" TYPE character varying(32);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "Court" TYPE character varying(256);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "Circuit" TYPE character varying(150);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "BourseDeedImageFileName" TYPE character varying(512);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "AssignmentDocFileName" TYPE character varying(512);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "Area" TYPE character varying(128);
                """);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkflowTasks" ALTER COLUMN "AssigneeId" TYPE character varying(128);
                """);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PropertyGroups" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE case_study."PropertyGroups" SET "UpdatedAtUtc" = "CreatedAtUtc";
                ALTER TABLE case_study."PropertyGroups" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PropertyContacts" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                ALTER TABLE case_study."PropertyContacts" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PoIntakeDrafts" ALTER COLUMN "UserId" TYPE character varying(128);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PartyTaskSubmissions" ALTER COLUMN "SubmittedByUserId" TYPE character varying(128);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PartyTaskSubmissions" ALTER COLUMN "ReopenedByUserId" TYPE character varying(128);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PartyTaskSubmissions" ALTER COLUMN "AcceptedByUserId" TYPE character varying(128);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."NumberedDocuments" ALTER COLUMN "CreatedByUserId" TYPE character varying(128);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "case_study",
                table: "PropertyGroups");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "case_study",
                table: "PropertyContacts");

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "UninspectedUnitsJson" TYPE text USING "UninspectedUnitsJson"::text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "RealEstateRegFileName" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "OwnerName" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "DeedStatus" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "DeedOwnershipFileName" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "DeedDate" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "Court" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "Circuit" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "BourseDeedImageFileName" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "AssignmentDocFileName" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties" ALTER COLUMN "Area" TYPE text;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkflowTasks" ALTER COLUMN "AssigneeId" TYPE character varying(64);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PoIntakeDrafts" ALTER COLUMN "UserId" TYPE character varying(450);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PartyTaskSubmissions" ALTER COLUMN "SubmittedByUserId" TYPE character varying(450);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PartyTaskSubmissions" ALTER COLUMN "ReopenedByUserId" TYPE character varying(450);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."PartyTaskSubmissions" ALTER COLUMN "AcceptedByUserId" TYPE character varying(450);
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."NumberedDocuments" ALTER COLUMN "CreatedByUserId" TYPE character varying(450);
                """);
        }
    }
}
