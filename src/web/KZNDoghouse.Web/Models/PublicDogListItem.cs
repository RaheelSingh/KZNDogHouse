using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Helpers;

namespace KZNDoghouse.Web.Models;

public class PublicDogListItem
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Gender { get; set; } = string.Empty;

    public string? Size { get; set; }

    public string ShortAgeText { get; set; } = string.Empty;

    public string? PhotoUrl { get; set; }

    public string Status { get; set; } = DogStatuses.Available;

    public DateTime IntakeDate { get; set; }

    public bool IsFostered => Status == DogStatuses.Fostered;

    public string StatusLabel => PublicDogStatusHelper.LabelFor(Status);

    public string Initial => PublicDogStatusHelper.InitialOf(Name);

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

            return string.Join(" · ", parts);
        }
    }

    public static PublicDogListItem FromDog(Dog dog)
    {
        return new PublicDogListItem
        {
            Id = dog.Id,
            Name = dog.Name,
            Gender = dog.Gender,
            Size = dog.Size,
            ShortAgeText = DogAgeHelper.Describe(
                dog.DateOfBirth,
                dog.EstimatedAgeYears,
                shortForm: true),
            PhotoUrl = dog.PhotoUrl,
            Status = dog.Status,
            IntakeDate = dog.IntakeDate
        };
    }
}
