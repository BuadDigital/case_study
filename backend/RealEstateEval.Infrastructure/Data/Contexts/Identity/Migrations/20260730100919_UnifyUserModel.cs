using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Identity.Migrations
{
    /// <inheritdoc />
    public partial class UnifyUserModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE identity."Users"
                SET "PhoneNumber" = NULL
                WHERE "PhoneNumber" IS NOT NULL
                  AND (length(trim("PhoneNumber")) = 0 OR length("PhoneNumber") > 20);

                WITH duplicates AS (
                    SELECT "Id",
                           row_number() OVER (
                               PARTITION BY "PhoneNumber"
                               ORDER BY "Id") AS occurrence
                    FROM identity."Users"
                    WHERE "PhoneNumber" IS NOT NULL
                )
                UPDATE identity."Users" AS users
                SET "PhoneNumber" = NULL,
                    "PhoneNumberConfirmed" = FALSE
                FROM duplicates
                WHERE users."Id" = duplicates."Id"
                  AND duplicates.occurrence > 1;

                UPDATE identity."Users"
                SET "DisplayName" = left("DisplayName", 256)
                WHERE length("DisplayName") > 256;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                schema: "identity",
                table: "Users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "DisplayName",
                schema: "identity",
                table: "Users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommercialRegistration",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Department",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FeeValueSar",
                schema: "identity",
                table: "UserProfiles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasCompensation",
                schema: "identity",
                table: "UserProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Iban",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(34)",
                maxLength: 34,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InspectorType",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "JoinedAt",
                schema: "identity",
                table: "UserProfiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NationalId",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RoleId",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxNumber",
                schema: "identity",
                table: "UserProfiles",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAtUtc",
                schema: "identity",
                table: "UserProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE identity."Users"
                SET
                    "PhoneNumber" = CASE "UserName"
                        WHEN 'sliman' THEN '+966500000001'
                        WHEN 'salam' THEN '+966500000002'
                        WHEN 'abdulrahman' THEN '+966500000003'
                        WHEN 'osama' THEN '+966500000004'
                        WHEN 'feras' THEN '+966500000005'
                        WHEN 'mohammed' THEN '+966500000006'
                        WHEN 'abdullah' THEN '+966500000007'
                        WHEN 'ahmed' THEN '+966500000008'
                        WHEN 'abdullah_m' THEN '+966500000009'
                        WHEN 'eman' THEN '+966500000010'
                        WHEN 'jeddah_survey' THEN '+966500000011'
                    END,
                    "PhoneNumberConfirmed" = TRUE
                WHERE "UserName" IN (
                    'sliman', 'salam', 'abdulrahman', 'osama', 'feras',
                    'mohammed', 'abdullah', 'ahmed', 'abdullah_m', 'eman',
                    'jeddah_survey');

                UPDATE identity."UserProfiles" AS profile
                SET
                    "RoleId" = CASE
                        WHEN profile."PermissionLevel" = 'cdo' THEN 'cdo'
                        WHEN profile."JobTitle" = 'مسؤول التحول الرقمي (CDO)' THEN 'cdo'
                        WHEN profile."JobTitle" = 'مدير إدارة التقييم العقاري' THEN 'general-manager'
                        WHEN profile."JobTitle" = 'مشرف قسم دراسة الحالة' THEN 'section-supervisor'
                        WHEN profile."JobTitle" = 'أخصائي دراسة حالة' THEN 'case-specialist'
                        WHEN profile."JobTitle" = 'مراجع حكومي' THEN 'government-reviewer'
                        WHEN profile."JobTitle" = 'منسق عمليات التقييم' THEN 'valuation-coordinator'
                        WHEN profile."JobTitle" = 'مقيم عقاري' THEN 'real-estate-appraiser'
                        WHEN profile."JobTitle" = 'معاين ميداني' THEN 'field-inspector'
                        WHEN profile."JobTitle" = 'موظف الشؤون المالية' THEN 'financial-officer'
                        WHEN profile."RegistrationSource" = 1 THEN 'engineering-office'
                    END,
                    "Department" = COALESCE(
                        (SELECT hr."Department"
                         FROM identity."HrEmployeeProfiles" AS hr
                         WHERE hr."UserId" = profile."UserId"),
                        CASE WHEN profile."RegistrationSource" = 1
                            THEN 'المكاتب الهندسية' END),
                    "City" = COALESCE(
                        (SELECT provider."Region"
                         FROM identity."ProcServiceProviderProfiles" AS provider
                         WHERE provider."UserId" = profile."UserId"),
                        'الرياض'),
                    "Iban" = (
                        SELECT provider."Iban"
                        FROM identity."ProcServiceProviderProfiles" AS provider
                        WHERE provider."UserId" = profile."UserId"),
                    "TaxNumber" = (
                        SELECT provider."VatRegistration"
                        FROM identity."ProcServiceProviderProfiles" AS provider
                        WHERE provider."UserId" = profile."UserId"),
                    "CommercialRegistration" = (
                        SELECT provider."CommercialRegistration"
                        FROM identity."ProcServiceProviderProfiles" AS provider
                        WHERE provider."UserId" = profile."UserId"),
                    "JoinedAt" = (
                        SELECT hr."JoinDate"
                        FROM identity."HrEmployeeProfiles" AS hr
                        WHERE hr."UserId" = profile."UserId");

                WITH identifiers AS (
                    SELECT source."UserId", source."NationalId"
                    FROM (
                        SELECT "UserId", "NationalId"
                        FROM identity."HrEmployeeProfiles"
                        WHERE "NationalId" IS NOT NULL
                        UNION ALL
                        SELECT "UserId", "NationalId"
                        FROM identity."ProcServiceProviderProfiles"
                        WHERE "NationalId" IS NOT NULL
                    ) AS source
                    JOIN (
                        SELECT "NationalId"
                        FROM (
                            SELECT "NationalId" FROM identity."HrEmployeeProfiles"
                            UNION ALL
                            SELECT "NationalId" FROM identity."ProcServiceProviderProfiles"
                        ) AS all_ids
                        WHERE "NationalId" IS NOT NULL
                        GROUP BY "NationalId"
                        HAVING COUNT(*) = 1
                    ) AS unique_ids USING ("NationalId")
                )
                UPDATE identity."UserProfiles" AS profile
                SET "NationalId" = identifiers."NationalId"
                FROM identifiers
                WHERE identifiers."UserId" = profile."UserId";

                UPDATE identity."UserProfiles"
                SET "InspectorType" = CASE
                    WHEN "RoleId" = 'field-inspector' AND "ContractType" = 0 THEN 'employee'
                    WHEN "RoleId" = 'field-inspector' THEN 'contractor'
                END;

                -- Unknown historical titles do not receive guessed permissions.
                UPDATE identity."UserProfiles"
                SET "Status" = 1
                WHERE "Status" = 0 AND "RoleId" IS NULL;

                WITH duplicates AS (
                    SELECT "Id",
                           row_number() OVER (
                               PARTITION BY "PhoneNumber"
                               ORDER BY "Id") AS occurrence
                    FROM identity."Users"
                    WHERE "PhoneNumber" IS NOT NULL
                )
                UPDATE identity."Users" AS users
                SET "PhoneNumber" = NULL,
                    "PhoneNumberConfirmed" = FALSE
                FROM duplicates
                WHERE users."Id" = duplicates."Id"
                  AND duplicates.occurrence > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Users_PhoneNumber",
                schema: "identity",
                table: "Users",
                column: "PhoneNumber",
                unique: true,
                filter: "\"PhoneNumber\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_NationalId",
                schema: "identity",
                table: "UserProfiles",
                column: "NationalId",
                unique: true,
                filter: "\"NationalId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_RoleId",
                schema: "identity",
                table: "UserProfiles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_Status",
                schema: "identity",
                table: "UserProfiles",
                column: "Status");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfiles_ActiveRequiresRoleAndCity",
                schema: "identity",
                table: "UserProfiles",
                sql: "\"Status\" <> 0 OR (\"RoleId\" IS NOT NULL AND \"City\" IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfiles_FeeValueSar",
                schema: "identity",
                table: "UserProfiles",
                sql: "\"FeeValueSar\" IS NULL OR \"FeeValueSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfiles_InspectorType",
                schema: "identity",
                table: "UserProfiles",
                sql: "\"InspectorType\" IS NULL OR \"InspectorType\" IN ('employee', 'contractor')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfiles_Status",
                schema: "identity",
                table: "UserProfiles",
                sql: "\"Status\" BETWEEN 0 AND 3");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_PhoneNumber",
                schema: "identity",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_NationalId",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_RoleId",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_Status",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfiles_ActiveRequiresRoleAndCity",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfiles_FeeValueSar",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfiles_InspectorType",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfiles_Status",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "City",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "CommercialRegistration",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "Department",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "FeeValueSar",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "HasCompensation",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "Iban",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "InspectorType",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "JoinedAt",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "NationalId",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "RoleId",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "TaxNumber",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                schema: "identity",
                table: "Users",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "DisplayName",
                schema: "identity",
                table: "Users",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256);
        }
    }
}
