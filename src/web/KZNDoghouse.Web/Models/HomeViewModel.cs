namespace KZNDoghouse.Web.Models;

public class HomeViewModel
{
    public IReadOnlyList<PublicDogListItem> HeroDogs { get; set; } =
        Array.Empty<PublicDogListItem>();

    public IReadOnlyList<PublicDogListItem> FeaturedDogs { get; set; } =
        Array.Empty<PublicDogListItem>();
}
