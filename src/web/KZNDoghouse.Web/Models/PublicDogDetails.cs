using System.Globalization;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Helpers;

namespace KZNDoghouse.Web.Models;

public class PublicDogDetails
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Breed { get; set; }

    public string Gender { get; set; } = string.Empty;

    public string? Size { get; set; }

    public decimal? WeightKg { get; set; }

    public string AgeText { get; set; } = string.Empty;

    public string? Temperament { get; set; }

    public string? About { get; set; }

    public bool IsVaccinated { get; set; }

    public string? PhotoUrl { get; set; }

    public string Status { get; set; } = DogStatuses.Available;

    public DateTime IntakeDate { get; set; }

    public bool IsFostered => Status == DogStatuses.Fostered;

    public string StatusLabel => PublicDogStatusHelper.LabelFor(Status);

    public string SinceText => IntakeDate.ToString("MMMM yyyy", CultureInfo.InvariantCulture);

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

            parts.Add(AgeText);

            if (!string.IsNullOrWhiteSpace(Size))
            {
                parts.Add(WeightKg.HasValue
                    ? string.Create(CultureInfo.InvariantCulture, $"{Size} ({WeightKg.Value:0.#}kg)")
                    : Size);
            }

            return string.Join(" · ", parts);
        }
    }

    public static PublicDogDetails FromDog(Dog dog)
    {
        return new PublicDogDetails
        {
            Id = dog.Id,
            Name = dog.Name,
            Breed = dog.Breed,
            Gender = dog.Gender,
            Size = dog.Size,
            WeightKg = dog.WeightKg,
            AgeText = DogAgeHelper.Describe(dog.DateOfBirth, dog.EstimatedAgeYears),
            Temperament = dog.Temperament,
            About = dog.About,
            IsVaccinated = dog.IsVaccinated,
            PhotoUrl = dog.PhotoUrl,
            Status = dog.Status,
            IntakeDate = dog.IntakeDate
        };
    }
}
