namespace KZNDoghouse.Web.Constants;

public static class AvailabilitySlotNames
{
    public const string Morning = "Morning";
    public const string Afternoon = "Afternoon";
    public const string Evening = "Evening";

    public static readonly string[] All = [Morning, Afternoon, Evening];
}

public static class AvailabilitySlotStatuses
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";

    public static readonly string[] All = [Pending, Approved, Rejected];
}