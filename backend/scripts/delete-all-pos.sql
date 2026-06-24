-- Deletes all PO / work-order operational data. Keeps users, roles, and catalog configs.
BEGIN;

DELETE FROM case_study."InspectorFeeTransitions";
DELETE FROM case_study."InspectorFeeLedgers";
DELETE FROM case_study."CaseStudyForms";
DELETE FROM case_study."FieldInspectionWorkspaces";
DELETE FROM case_study."PartyTaskSubmissions";
DELETE FROM failures."PropertyFailures";
DELETE FROM case_study."WorkflowTasks";
DELETE FROM case_study."PropertyTimelineEntries";
DELETE FROM case_study."InternalDelegationLetterSets";
DELETE FROM valuation."EvaluatorRecallRecords";
DELETE FROM valuation."ValuationRequests";
DELETE FROM operations."PropertyKeyRecords";
DELETE FROM case_study."PropertyContacts";
DELETE FROM case_study."WorkOrderProperties";
DELETE FROM case_study."WorkOrders";
DELETE FROM case_study."PoIntakeDrafts";
DELETE FROM attachments."FileAttachments";
DELETE FROM messaging."OutboxMessages";

COMMIT;

SELECT
  (SELECT COUNT(*) FROM case_study."WorkOrders") AS work_orders_remaining,
  (SELECT COUNT(*) FROM case_study."WorkflowTasks") AS workflow_tasks_remaining;
