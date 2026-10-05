namespace KZNDoghouse.Web.Models;

public class DogGalleryViewModel
{
    public string DogName { get; set; } = string.Empty;

    public string Initial { get; set; } = "?";

    public IReadOnlyList<string> ImageUrls { get; set; } =
        Array.Empty<string>();

    public string Variant { get; set; } = "detail";

    public bool AutoPlay { get; set; }
}
