namespace KZNDoghouse.Web.Constants;

public static class ContactTopics
{
    public const string Fostering = "Fostering";
    public const string Volunteering = "Volunteering";
    public const string Adoption = "Adoption";
    public const string DonationsAndPartnerships = "Donations & partnerships";
    public const string SomethingElse = "Something else";
    public const string AccountDeletion = "Account deletion";

    public static readonly string[] All =
    [
        Fostering, Volunteering, Adoption, DonationsAndPartnerships, SomethingElse,
        AccountDeletion
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
            "account-deletion" => AccountDeletion,
            _ => null
        };
    }
}
