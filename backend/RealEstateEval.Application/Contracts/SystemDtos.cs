namespace RealEstateEval.Application.Contracts;

public class SystemResetResultDto
{
    public int WorkOrdersDeleted { get; set; }
    public int WorkflowTasksDeleted { get; set; }
    public int CaseStudyFormsDeleted { get; set; }
    public int CourtCatalogEntriesDeleted { get; set; }
    public int CaseStudyInfoRolesConfigsDeleted { get; set; }
    public int PropertyFailuresDeleted { get; set; }
    public int RegisteredUsersDeleted { get; set; }
    public int PoIntakeDraftsDeleted { get; set; }
    public int AttachmentsDeleted { get; set; }
    public int InternalDelegationLetterSetsDeleted { get; set; }
    public int EvaluatorRecallsDeleted { get; set; }
    public int FieldDictionaryConfigsDeleted { get; set; }
    public int FailureTypesCatalogConfigsDeleted { get; set; }
    public int CustomAssignedScreensDeleted { get; set; }
    public int SurveyOfficesDeleted { get; set; }
    public int ValuationRequestsDeleted { get; set; }
    public int PropertyKeyRecordsDeleted { get; set; }
    public int FinancialReportConfigsDeleted { get; set; }
}
