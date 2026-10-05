namespace KZNDoghouse.Web.Constants;

public static class DogStatuses
{
    public const string Available = "Available";
    public const string InCare = "In Care";
    public const string UnderTreatment = "Under Treatment";
    public const string Fostered = "Fostered";
    public const string Reserved = "Reserved";
    public const string Adopted = "Adopted";

    public static readonly string[] All =
    [
        Available, InCare, UnderTreatment, Fostered, Reserved, Adopted
    ];
}

public static class DogGenders
{
    public const string Male = "Male";
    public const string Female = "Female";
    public const string Unknown = "Unknown";

    public static readonly string[] All = [Male, Female, Unknown];
}

public static class DogSizes
{
    public const string Small = "Small";
    public const string Medium = "Medium";
    public const string Large = "Large";

    public static readonly string[] All = [Small, Medium, Large];
}

public static class DogIntakeTypes
{
    public const string Stray = "Stray";
    public const string Rescued = "Rescued";
    public const string OwnerSurrender = "Owner surrender";
    public const string Transferred = "Transferred";
    public const string BornAtShelter = "Born at shelter";
    public const string Other = "Other";

    public static readonly string[] All =
    [
        Stray, Rescued, OwnerSurrender, Transferred, BornAtShelter, Other
    ];
}
