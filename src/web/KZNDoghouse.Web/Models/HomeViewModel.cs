namespace KZNDoghouse.Web.Models;

public class HomeViewModel
{
    public IReadOnlyList<PublicDogListItem> FeaturedDogs { get; set; } =
        Array.Empty<PublicDogListItem>();
}
