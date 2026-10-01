namespace KZNDoghouse.Web.Models;

public class PublicDogListViewModel
{
    public IReadOnlyList<PublicDogListItem> Dogs { get; set; } =
        Array.Empty<PublicDogListItem>();

    public int TotalCount { get; set; }

    public PublicDogFilter Filter { get; set; } = new();

    public IReadOnlyList<string> SizeOptions { get; set; } =
        Array.Empty<string>();
}
