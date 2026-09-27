namespace KZNDoghouse.Web.Models;

public class FosterApplicationListItem
{
    public FosterApplication Application { get; set; } = null!;

    public string DogName { get; set; } = "No dog assigned";
}