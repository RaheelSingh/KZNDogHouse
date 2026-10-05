namespace KZNDoghouse.Web.Models;

public class PublicDogFilter
{
    public const int PageSize = 8;

    public const int MaxTake = 200;

    public const string StatusReady = "ready";

    public const string StatusFoster = "foster";

    public const string SortNewest = "newest";

    public const string SortName = "name";

    public static readonly string[] SizeOptions = ["Small", "Medium", "Large"];

    public static readonly string[] StatusOptions = [StatusReady, StatusFoster];

    public string? Size { get; set; }

    public string? Status { get; set; }

    public string Sort { get; set; } = SortNewest;

    public int Take { get; set; } = PageSize;

    public bool IsActive => Size != null || Status != null;

    public static PublicDogFilter Create(string? size, string? status, string? sort, int? take)
    {
        return new PublicDogFilter
        {
            Size = SizeOptions.FirstOrDefault(
                x => string.Equals(x, size?.Trim(), StringComparison.OrdinalIgnoreCase)),
            Status = StatusOptions.FirstOrDefault(
                x => string.Equals(x, status?.Trim(), StringComparison.OrdinalIgnoreCase)),
            Sort = string.Equals(sort?.Trim(), SortName, StringComparison.OrdinalIgnoreCase)
                ? SortName
                : SortNewest,
            Take = Math.Clamp(take ?? PageSize, PageSize, MaxTake)
        };
    }

    public IReadOnlyList<PublicDogListItem> Apply(IEnumerable<PublicDogListItem> dogs)
    {
        var query = dogs;

        if (Size != null)
        {
            query = query.Where(x =>
                string.Equals(x.Size, Size, StringComparison.OrdinalIgnoreCase));
        }

        if (Status == StatusReady)
        {
            query = query.Where(x => !x.IsFostered);
        }
        else if (Status == StatusFoster)
        {
            query = query.Where(x => x.IsFostered);
        }

        query = Sort == SortName
            ? query.OrderBy(x => x.Name)
            : query.OrderByDescending(x => x.IntakeDate).ThenBy(x => x.Name);

        return query.ToList();
    }
}
