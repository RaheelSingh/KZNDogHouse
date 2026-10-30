namespace KZNDoghouse.Web.Models;

public class PublicDogDetailsViewModel
{
    public PublicDogDetails Dog { get; set; } = null!;
    public IReadOnlyList<DogVideo> Videos { get; set; } = Array.Empty<DogVideo>();

    public IReadOnlyList<PublicDogListItem> MoreDogs { get; set; } =
        Array.Empty<PublicDogListItem>();
}
