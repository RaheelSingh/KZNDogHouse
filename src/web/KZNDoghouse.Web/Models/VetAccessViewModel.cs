namespace KZNDoghouse.Web.Models;

public class VetAccessViewModel
{
    public UserProfile VetUser { get; set; } = null!;

    public IReadOnlyList<Dog> Dogs { get; set; } =
        Array.Empty<Dog>();

    public IReadOnlySet<Guid> AuthorizedDogIds { get; set; } =
        new HashSet<Guid>();
}
