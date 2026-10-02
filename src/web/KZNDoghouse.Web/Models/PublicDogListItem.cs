using KZNDoghouse.Web.Constants;
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

    public string ShortAgeText { get; set; } = string.Empty;

    public string? Temperament { get; set; }

    public string? PhotoUrl { get; set; }

    public string Status { get; set; } = DogStatuses.Available;

    public DateTime IntakeDate { get; set; }

    public bool IsFostered => Status == DogStatuses.Fostered;

    public string StatusLabel => PublicDogStatusHelper.LabelFor(Status);

    public string MetaText
    {
        get
        {
            var parts = new List<string>();

            if (Gender == DogGenders.Male || Gender == DogGenders.Female)
            {
                parts.Add(Gender);
            }

            parts.Add(ShortAgeText);

            if (!string.IsNullOrWhiteSpace(Size))
            {
                parts.Add(Size);
            }

            return string.Join(" \u00B7 ", parts);
        }
    }

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
            ShortAgeText = DogAgeHelper.Describe(
                dog.DateOfBirth,
                dog.EstimatedAgeYears,
                shortForm: true),
            Temperament = dog.Temperament,
            PhotoUrl = dog.PhotoUrl,
            Status = dog.Status,
            IntakeDate = dog.IntakeDate
        };
    }
}
