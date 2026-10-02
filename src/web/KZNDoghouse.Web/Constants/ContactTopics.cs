namespace KZNDoghouse.Web.Constants;

public static class ContactTopics
{
    public const string Fostering = "Fostering";
    public const string Volunteering = "Volunteering";
    public const string Adoption = "Adoption";
    public const string DonationsAndPartnerships = "Donations & partnerships";
    public const string SomethingElse = "Something else";

    public static readonly string[] All =
    [
        Fostering, Volunteering, Adoption, DonationsAndPartnerships, SomethingElse
    ];

    public static string? FromKey(string? key)
    {
        return key?.Trim().ToLowerInvariant() switch
        {
            "fostering" => Fostering,
            "volunteering" => Volunteering,
            "adoption" => Adoption,
            "donations" => DonationsAndPartnerships,
            "other" => SomethingElse,
            _ => null
        };
    }
}
