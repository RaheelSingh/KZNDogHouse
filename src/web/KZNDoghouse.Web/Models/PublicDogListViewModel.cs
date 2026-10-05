namespace KZNDoghouse.Web.Models;

public class PublicDogListViewModel
{
    public IReadOnlyList<PublicDogListItem> Dogs { get; set; } =
        Array.Empty<PublicDogListItem>();

    public int MatchCount { get; set; }

    public int OverallCount { get; set; }

    public PublicDogFilter Filter { get; set; } = new();

    public bool HasMore => Dogs.Count < MatchCount;

    public int NextTake => Filter.Take + PublicDogFilter.PageSize;
}
