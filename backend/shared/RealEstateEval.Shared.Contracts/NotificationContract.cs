namespace RealEstateEval.Shared.Contracts;

/// <summary>
/// Canonical wire/storage values for user notifications. Normalizers keep rows and
/// events written by older versions readable while all new writes use one contract.
/// </summary>
public static class NotificationContract
{
    public static class Tones
    {
        public const string Info = "info";
        public const string Success = "success";
        public const string Warn = "warn";

        public static string? Normalize(string? value) =>
            value?.Trim().ToLowerInvariant() switch
            {
                "info" => Info,
                "success" => Success,
                "warn" or "warning" => Warn,
                _ => null,
            };
    }

    public static class Categories
    {
        public const string Workflow = "workflow";
        public const string Financial = "financial";
        public const string Failures = "failures";
        public const string System = "system";

        public static string? Normalize(string? value) =>
            value?.Trim().ToLowerInvariant() switch
            {
                "workflow" => Workflow,
                "financial" => Financial,
                "failures" => Failures,
                "system" => System,
                _ => null,
            };
    }

    public static class EntityTypes
    {
        public const string Property = "property";
        public const string Task = "task";
        public const string OperationsTask = "operations-task";
        public const string Failure = "failure";
        public const string WorkOrder = "work-order";

        public static string? Normalize(string? value) =>
            value?.Trim().ToLowerInvariant() switch
            {
                "property" => Property,
                "task" => Task,
                "operations-task" => OperationsTask,
                "failure" => Failure,
                "work-order" => WorkOrder,
                _ => null,
            };
    }
}
