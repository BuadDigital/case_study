using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class PropertyIdAsUuidJsonbAndChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Property and task ids become uuids. Every consumer already required a Guid to reach the
            // property (context lookup, attachments, comparables), so a request whose key is not one
            // was never linked to anything and is removed with its dependents (FK cascades) rather
            // than cast; the legacy demo rows E-440x are the known case. JSON columns move to jsonb
            // with explicit casts; blanks become NULL, or {} where the column is required.
            migrationBuilder.Sql(
                """
                DELETE FROM valuation."ValuationRequests"
                WHERE "PropertyId" !~* '^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$';
                ALTER TABLE valuation."ValuationRequests"
                    ALTER COLUMN "PropertyId" TYPE uuid USING "PropertyId"::uuid;

                DELETE FROM valuation."EvaluatorRecallRecords"
                WHERE "PropertyId" !~* '^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$'
                   OR "TaskId" !~* '^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$';
                ALTER TABLE valuation."EvaluatorRecallRecords"
                    ALTER COLUMN "TaskId" TYPE uuid USING "TaskId"::uuid,
                    ALTER COLUMN "PropertyId" TYPE uuid USING "PropertyId"::uuid;

                ALTER TABLE valuation."ValuationReportIssuances"
                    ALTER COLUMN "DocumentJson" TYPE jsonb
                    USING (CASE WHEN "DocumentJson" = '' THEN '{}' ELSE "DocumentJson" END)::jsonb;
                ALTER TABLE valuation."ValuationReconciliations"
                    ALTER COLUMN "MethodologyAlertOverridesJson" TYPE jsonb
                    USING NULLIF("MethodologyAlertOverridesJson", '')::jsonb;
                ALTER TABLE valuation."ValuationMarketApproaches"
                    ALTER COLUMN "SubjectSpecJson" TYPE jsonb
                    USING NULLIF("SubjectSpecJson", '')::jsonb;
                ALTER TABLE valuation."ValuationApproachSettings"
                    ALTER COLUMN "SelectedAssumptionsJson" TYPE jsonb
                    USING NULLIF("SelectedAssumptionsJson", '')::jsonb;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationRequests_Status",
                schema: "valuation",
                table: "ValuationRequests",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('progress', 'done', 'fail')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationReconciliationMethodLines_ApproachValue_NonNegative",
                schema: "valuation",
                table: "ValuationReconciliationMethodLines",
                sql: "\"ApproachValue\" IS NULL OR \"ApproachValue\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationMarketApproaches_SubjectAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches",
                sql: "\"SubjectAreaSqm\" IS NULL OR \"SubjectAreaSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostLines_AreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostLines",
                sql: "\"AreaSqm\" IS NULL OR \"AreaSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostLines_UnitCostSar_NonNegative",
                schema: "valuation",
                table: "ValuationCostLines",
                sql: "\"UnitCostSar\" IS NULL OR \"UnitCostSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_ActualAgeYears_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"ActualAgeYears\" IS NULL OR \"ActualAgeYears\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_ApartmentLandShareSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"ApartmentLandShareSqm\" IS NULL OR \"ApartmentLandShareSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_EconomicAgeYears_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"EconomicAgeYears\" IS NULL OR \"EconomicAgeYears\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_LandAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"LandAreaSqm\" IS NULL OR \"LandAreaSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_LandUnitRateFromMarket_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"LandUnitRateFromMarket\" IS NULL OR \"LandUnitRateFromMarket\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_LandValueFromMarket_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"LandValueFromMarket\" IS NULL OR \"LandValueFromMarket\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationCostApproaches_LifeExtensionYears_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches",
                sql: "\"LifeExtensionYears\" IS NULL OR \"LifeExtensionYears\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationComparableSelections_AreaOverrideSqm_NonNegative",
                schema: "valuation",
                table: "ValuationComparableSelections",
                sql: "\"AreaOverrideSqm\" IS NULL OR \"AreaOverrideSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ValuationComparableSelections_PriceOverrideSar_NonNegative",
                schema: "valuation",
                table: "ValuationComparableSelections",
                sql: "\"PriceOverrideSar\" IS NULL OR \"PriceOverrideSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EvaluatorRecallRecords_Status",
                schema: "valuation",
                table: "EvaluatorRecallRecords",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('pending', 'approved', 'rejected')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ComparableProperties_AreaSqm_NonNegative",
                schema: "valuation",
                table: "ComparableProperties",
                sql: "\"AreaSqm\" IS NULL OR \"AreaSqm\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ComparableProperties_Price_NonNegative",
                schema: "valuation",
                table: "ComparableProperties",
                sql: "\"Price\" IS NULL OR \"Price\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ComparableProperties_PricePerSqm_NonNegative",
                schema: "valuation",
                table: "ComparableProperties",
                sql: "\"PricePerSqm\" IS NULL OR \"PricePerSqm\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationRequests_Status",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationReconciliationMethodLines_ApproachValue_NonNegative",
                schema: "valuation",
                table: "ValuationReconciliationMethodLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationMarketApproaches_SubjectAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationMarketApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostLines_AreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostLines_UnitCostSar_NonNegative",
                schema: "valuation",
                table: "ValuationCostLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_ActualAgeYears_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_ApartmentLandShareSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_EconomicAgeYears_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_LandAreaSqm_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_LandUnitRateFromMarket_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_LandValueFromMarket_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationCostApproaches_LifeExtensionYears_NonNegative",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationComparableSelections_AreaOverrideSqm_NonNegative",
                schema: "valuation",
                table: "ValuationComparableSelections");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ValuationComparableSelections_PriceOverrideSar_NonNegative",
                schema: "valuation",
                table: "ValuationComparableSelections");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EvaluatorRecallRecords_Status",
                schema: "valuation",
                table: "EvaluatorRecallRecords");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ComparableProperties_AreaSqm_NonNegative",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ComparableProperties_Price_NonNegative",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ComparableProperties_PricePerSqm_NonNegative",
                schema: "valuation",
                table: "ComparableProperties");

            migrationBuilder.Sql(
                """
                ALTER TABLE valuation."ValuationRequests"
                    ALTER COLUMN "PropertyId" TYPE character varying(128) USING "PropertyId"::text;
                ALTER TABLE valuation."EvaluatorRecallRecords"
                    ALTER COLUMN "TaskId" TYPE character varying(64) USING "TaskId"::text,
                    ALTER COLUMN "PropertyId" TYPE character varying(128) USING "PropertyId"::text;
                ALTER TABLE valuation."ValuationReportIssuances"
                    ALTER COLUMN "DocumentJson" TYPE text USING "DocumentJson"::text;
                ALTER TABLE valuation."ValuationReconciliations"
                    ALTER COLUMN "MethodologyAlertOverridesJson" TYPE text USING "MethodologyAlertOverridesJson"::text;
                ALTER TABLE valuation."ValuationMarketApproaches"
                    ALTER COLUMN "SubjectSpecJson" TYPE character varying(4000) USING "SubjectSpecJson"::text;
                ALTER TABLE valuation."ValuationApproachSettings"
                    ALTER COLUMN "SelectedAssumptionsJson" TYPE text USING "SelectedAssumptionsJson"::text;
                """);
        }
    }
}
