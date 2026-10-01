using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Models;

public class PublicDogFilter
{
    public const int MaxTextLength = 50;

    public static readonly string[] GenderOptions =
    [
        DogGenders.Male, DogGenders.Female
    ];

    public string? Search { get; set; }

    public string? Gender { get; set; }

    public string? Size { get; set; }

    public bool IsActive =>
        !string.IsNullOrEmpty(Search)
        || !string.IsNullOrEmpty(Gender)
        || !string.IsNullOrEmpty(Size);

    public static PublicDogFilter Create(string? search, string? gender, string? size)
    {
        return new PublicDogFilter
        {
            Search = Clean(search),
            Gender = GenderOptions.FirstOrDefault(
                x => string.Equals(x, gender?.Trim(), StringComparison.OrdinalIgnoreCase)),
            Size = Clean(size)
        };
    }

    public IReadOnlyList<PublicDogListItem> Apply(IEnumerable<PublicDogListItem> dogs)
    {
        var query = dogs;

        if (!string.IsNullOrEmpty(Search))
        {
            query = query.Where(x =>
                Contains(x.Name, Search)
                || Contains(x.Breed, Search)
                || Contains(x.Temperament, Search));
        }

        if (!string.IsNullOrEmpty(Gender))
        {
            query = query.Where(x => x.Gender == Gender);
        }

        if (!string.IsNullOrEmpty(Size))
        {
            query = query.Where(x =>
                string.Equals(x.Size, Size, StringComparison.OrdinalIgnoreCase));
        }

        return query.ToList();
    }

    private static string? Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();

        return trimmed.Length > MaxTextLength
            ? trimmed[..MaxTextLength]
            : trimmed;
    }

    private static bool Contains(string? text, string search)
    {
        return text != null
            && text.Contains(search, StringComparison.OrdinalIgnoreCase);
    }
}
