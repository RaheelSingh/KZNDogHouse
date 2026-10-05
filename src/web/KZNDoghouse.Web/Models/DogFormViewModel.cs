using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Models;

public class DogFormViewModel : IValidatableObject
{
    [Required(ErrorMessage = "Dog name is required.")]
    [StringLength(100, ErrorMessage = "Dog name must be 100 characters or fewer.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Breed { get; set; }

    [Display(Name = "Date of birth")]
    [DataType(DataType.Date)]
    public DateTime? DateOfBirth { get; set; }

    [Display(Name = "Estimated age (years)")]
    [Range(0, 30, ErrorMessage = "Estimated age must be between 0 and 30 years.")]
    public int? EstimatedAgeYears { get; set; }

    [Required]
    [RegularExpression("^(Male|Female|Unknown)$", ErrorMessage = "Choose a valid gender.")]
    public string Gender { get; set; } = DogGenders.Unknown;

    [RegularExpression("^(Small|Medium|Large)$", ErrorMessage = "Choose Small, Medium or Large.")]
    public string? Size { get; set; }

    [Display(Name = "Weight (kg)")]
    [Range(0, 120, ErrorMessage = "Weight must be between 0 and 120 kg.")]
    public decimal? WeightKg { get; set; }

    [Display(Name = "Eye colour")]
    [StringLength(80)]
    public string? EyeColour { get; set; }

    [StringLength(300)]
    public string? Temperament { get; set; }

    [StringLength(2000)]
    public string? About { get; set; }

    [Display(Name = "Kennel location")]
    [StringLength(100)]
    public string? KennelLocation { get; set; }

    [Required]
    [Display(Name = "Intake date")]
    [DataType(DataType.Date)]
    public DateTime IntakeDate { get; set; } = DateTime.UtcNow.Date;

    [Display(Name = "Intake type")]
    [RegularExpression("^(Stray|Rescued|Owner surrender|Transferred|Born at shelter|Other)$",
        ErrorMessage = "Choose a valid intake type.")]
    public string? IntakeType { get; set; }

    [Required]
    [RegularExpression("^(Available|In Care|Under Treatment|Fostered|Reserved|Adopted)$",
        ErrorMessage = "Choose a valid dog status.")]
    public string Status { get; set; } = DogStatuses.InCare;

    [Display(Name = "Vaccinated")]
    public bool IsVaccinated { get; set; }

    [Display(Name = "Dog images")]
    public List<IFormFile> Images { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var today = DateTime.UtcNow.Date;

        if (DateOfBirth.HasValue && DateOfBirth.Value.Date > today)
        {
            yield return new ValidationResult(
                "Date of birth cannot be in the future.",
                [nameof(DateOfBirth)]);
        }

        if (IntakeDate.Date > today)
        {
            yield return new ValidationResult(
                "Intake date cannot be in the future.",
                [nameof(IntakeDate)]);
        }

        if (DateOfBirth.HasValue && DateOfBirth.Value.Date > IntakeDate.Date)
        {
            yield return new ValidationResult(
                "Date of birth cannot be after the intake date.",
                [nameof(DateOfBirth)]);
        }

        var selectedImages = Images
            .Where(x => x != null && x.Length > 0)
            .ToList();

        if (selectedImages.Count > 10)
        {
            yield return new ValidationResult(
                "Choose no more than 10 images at a time.",
                [nameof(Images)]);
        }

        foreach (var image in selectedImages)
        {
            if (image.Length > 5 * 1024 * 1024)
            {
                yield return new ValidationResult(
                    $"{image.FileName} is larger than 5 MB.",
                    [nameof(Images)]);
            }
        }
    }
}
