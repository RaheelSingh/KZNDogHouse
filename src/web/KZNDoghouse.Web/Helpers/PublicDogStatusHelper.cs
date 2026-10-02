using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Helpers;

public static class PublicDogStatusHelper
{
    public static readonly string[] PublicStatuses =
    [
        DogStatuses.Available, DogStatuses.Fostered
    ];

    public static bool IsPublic(string status)
    {
        return PublicStatuses.Contains(status);
    }

    public static string LabelFor(string status)
    {
        return status == DogStatuses.Fostered
            ? "In foster care"
            : "Ready to adopt";
    }

    public static string InitialOf(string name)
    {
        var trimmed = name?.Trim();

        return string.IsNullOrEmpty(trimmed)
            ? "?"
            : trimmed[..1].ToUpperInvariant();
    }
}
