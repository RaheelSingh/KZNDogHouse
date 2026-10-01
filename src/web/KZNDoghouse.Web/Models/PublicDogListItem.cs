using KZNDoghouse.Web.Helpers;

namespace KZNDoghouse.Web.Models;

public class PublicDogListItem
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Breed { get; set; }

    public string Gender { get; set; } = string.Empty;

    public string? Size { get; set; }

    public string AgeText { get; set; } = string.Empty;

    public string? Temperament { get; set; }

    public string? PhotoUrl { get; set; }

    public static PublicDogListItem FromDog(Dog dog)
    {
        return new PublicDogListItem
        {
            Id = dog.Id,
            Name = dog.Name,
            Breed = dog.Breed,
            Gender = dog.Gender,
            Size = dog.Size,
            AgeText = DogAgeHelper.Describe(dog.DateOfBirth, dog.EstimatedAgeYears),
            Temperament = dog.Temperament,
            PhotoUrl = dog.PhotoUrl
        };
    }
}
