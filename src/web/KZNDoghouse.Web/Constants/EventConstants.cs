namespace KZNDoghouse.Web.Constants;

public static class EventCategories
{
    public const string Shift = "Shift";
    public const string VetAndCare = "Vet & Care";
    public const string Meeting = "Meeting";
    public const string PublicEvent = "Public Event";
    public const string Other = "Other";

    public static readonly string[] All =
    [
        Shift, VetAndCare, Meeting, PublicEvent, Other
    ];
}

public static class EventVisibilities
{
    public const string Internal = "Internal";
    public const string Public = "Public";

    public static readonly string[] All = [Internal, Public];
}

public static class EventAssignmentStatuses
{
    public const string Assigned = "Assigned";
    public const string Registered = "Registered";
    public const string Confirmed = "Confirmed";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All =
    [
        Assigned, Registered, Confirmed, Cancelled
    ];
}