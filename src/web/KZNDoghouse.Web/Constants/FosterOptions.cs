namespace KZNDoghouse.Web.Constants;

public static class FosterOptions
{
    public const string Yes = "Yes";
    public const string No = "No";
    public const string NotApplicable = "N/A";
    public const string NoPreference = "No preference";

    public static readonly string[] HomeTypes =
    [
        "House with garden",
        "House without garden",
        "Apartment or flat",
        "Townhouse or complex",
        "Farm or smallholding"
    ];

    public static readonly string[] FencedAnswers =
    [
        Yes, No, NotApplicable
    ];

    public static readonly string[] SizePreferences =
    [
        "Small", "Medium", "Large", NoPreference
    ];
}
