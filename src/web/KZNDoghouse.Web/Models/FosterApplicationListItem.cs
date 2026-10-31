namespace KZNDoghouse.Web.Models;

public class FosterApplicationListItem
{
    public IReadOnlyList<DogDocument> Documents { get; set; } = Array.Empty<DogDocument>();
    public FosterApplication Application { get; set; } = null!;

    public string DogName { get; set; } = "No dog assigned";
}