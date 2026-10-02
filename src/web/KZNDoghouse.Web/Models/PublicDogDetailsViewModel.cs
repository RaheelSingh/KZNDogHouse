namespace KZNDoghouse.Web.Models;

public class PublicDogDetailsViewModel
{
    public PublicDogDetails Dog { get; set; } = null!;

    public IReadOnlyList<PublicDogListItem> MoreDogs { get; set; } =
        Array.Empty<PublicDogListItem>();
}
