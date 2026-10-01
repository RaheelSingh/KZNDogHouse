using KZNDoghouse.Web.Helpers;

namespace KZNDoghouse.Web.Models;

public class PublicDogDetails
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Breed { get; set; }

    public string Gender { get; set; } = string.Empty;

    public string? Size { get; set; }

    public string AgeText { get; set; } = string.Empty;

    public string? Temperament { get; set; }

    public string? About { get; set; }

    public bool IsVaccinated { get; set; }

    public string? PhotoUrl { get; set; }

    public static PublicDogDetails FromDog(Dog dog)
    {
        return new PublicDogDetails
        {
            Id = dog.Id,
            Name = dog.Name,
            Breed = dog.Breed,
            Gender = dog.Gender,
            Size = dog.Size,
            AgeText = DogAgeHelper.Describe(dog.DateOfBirth, dog.EstimatedAgeYears),
            Temperament = dog.Temperament,
            About = dog.About,
            IsVaccinated = dog.IsVaccinated,
            PhotoUrl = dog.PhotoUrl
        };
    }
}
