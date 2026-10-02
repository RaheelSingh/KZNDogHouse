namespace KZNDoghouse.Web.Models;

public class PublicEventFilter
{
    public string? Category { get; set; }

    public bool IsActive => Category != null;

    public static PublicEventFilter Create(string? category, IEnumerable<string> availableCategories)
    {
        return new PublicEventFilter
        {
            Category = availableCategories.FirstOrDefault(
                x => string.Equals(x, category?.Trim(), StringComparison.OrdinalIgnoreCase))
        };
    }

    public IReadOnlyList<PublicEventItem> Apply(IEnumerable<PublicEventItem> events)
    {
        if (Category == null)
        {
            return events.ToList();
        }

        return events
            .Where(x => string.Equals(x.Category, Category, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }
}
