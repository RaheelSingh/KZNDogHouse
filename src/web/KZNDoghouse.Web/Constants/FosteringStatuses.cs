namespace KZNDoghouse.Web.Constants;

public static class FosteringRecordStatuses
{
    public const string Active = "Active";
    public const string Completed = "Completed";

    public static readonly string[] All = [Active, Completed];
}

public static class FosterApplicationStatuses
{
    public const string Submitted = "Submitted";
    public const string UnderReview = "Under Review";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";

    public static readonly string[] All =
    [
        Submitted, UnderReview, Approved, Rejected
    ];
}