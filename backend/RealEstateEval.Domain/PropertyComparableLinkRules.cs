namespace RealEstateEval.Domain;

public static class PropertyComparableLinkRules
{
    public const int MinimumLinkedForAppraisalPrep = 2;

    public static bool MeetsMinimum(int linkedCount) =>
        linkedCount >= MinimumLinkedForAppraisalPrep;
}
