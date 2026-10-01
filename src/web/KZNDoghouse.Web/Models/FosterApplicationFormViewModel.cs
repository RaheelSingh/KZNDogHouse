using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Models;

public class FosterApplicationFormViewModel : IValidatableObject
{
    [Required]
    [Display(Name = "Full name")]
    [StringLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Phone number")]
    [StringLength(25)]
    [RegularExpression(
        @"^(?=(?:\D*\d){8,15}\D*$)\+?[0-9(][0-9\s\-()]*$",
        ErrorMessage = "Enter a valid phone number, for example 031 123 4567.")]
    public string Phone { get; set; } = string.Empty;

    [Display(Name = "Dog you would like to foster")]
    public Guid? DogId { get; set; }

    [Required(ErrorMessage = "Please choose how long you could foster for.")]
    [Display(Name = "Foster period")]
    public string FosterPeriod { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please tell us whether your property is fully fenced.")]
    [Display(Name = "Fully fenced property")]
    public bool? HasFullyFencedProperty { get; set; }

    [Required(ErrorMessage = "Please tell us whether the dog would have grass or daily walks on grass.")]
    [Display(Name = "Grass or daily walks")]
    public bool? HasGrassOrDailyWalks { get; set; }

    [Required(ErrorMessage = "Please tell us whether someone is home day and night.")]
    [Display(Name = "Someone home day and night")]
    public bool? SomeoneHomeDayAndNight { get; set; }

    [Required(ErrorMessage = "Please tell us whether there is an indoor sleeping area.")]
    [Display(Name = "Indoor sleeping area")]
    public bool? HasIndoorSleepingArea { get; set; }

    [Display(Name = "Experience with dogs")]
    [StringLength(1000)]
    public string? Experience { get; set; }

    [Required(ErrorMessage = "Please tell us why you would like to foster.")]
    [Display(Name = "Why would you like to foster?")]
    [StringLength(1000)]
    public string Motivation { get; set; } = string.Empty;

    [Range(
        typeof(bool),
        "true",
        "true",
        ErrorMessage = "Please confirm that the information you provided is accurate.")]
    [Display(Name = "Confirmation")]
    public bool ConfirmAccurate { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!string.IsNullOrWhiteSpace(FosterPeriod)
            && !FosterPeriods.All.Contains(FosterPeriod))
        {
            yield return new ValidationResult(
                "Please choose one of the listed foster periods.",
                [nameof(FosterPeriod)]);
        }
    }
}
