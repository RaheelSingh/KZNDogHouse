namespace KZNDoghouse.Web.Models;

public class FosterPageViewModel
{
    public IReadOnlyList<PublicDogListItem> NeedFosterDogs { get; set; } =
        Array.Empty<PublicDogListItem>();
}
