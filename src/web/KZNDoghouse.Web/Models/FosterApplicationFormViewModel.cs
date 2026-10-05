using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Models;

public class FosterApplicationFormViewModel : IValidatableObject
{
    [Required]
    [Display(Name = "First name")]
    [StringLength(50)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Last name")]
    [StringLength(50)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Email address")]
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

    [Required]
    [Display(Name = "Home address")]
    [StringLength(200)]
    public string HomeAddress { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please choose your type of home.")]
    [Display(Name = "Type of home")]
    public string HomeType { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please tell us whether your garden is fully fenced.")]
    [Display(Name = "Garden fully fenced")]
    public string GardenFenced { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please tell us whether the dog would have grass or daily walks on grass.")]
    [Display(Name = "Grass or daily walks")]
    public bool? HasGrassOrDailyWalks { get; set; }

    [Required(ErrorMessage = "Please tell us whether someone is home day and night.")]
    [Display(Name = "Someone home day and night")]
    public bool? SomeoneHomeDayAndNight { get; set; }

    [Required(ErrorMessage = "Please tell us whether there is an indoor sleeping area.")]
    [Display(Name = "Indoor sleeping area")]
    public bool? HasIndoorSleepingArea { get; set; }

    [Required(ErrorMessage = "Please tell us whether you have other pets.")]
    [Display(Name = "Other pets")]
    public bool? HasOtherPets { get; set; }

    [Required(ErrorMessage = "Please tell us whether there are children in the household.")]
    [Display(Name = "Children in the household")]
    public bool? HasChildren { get; set; }

    public Guid? DogId { get; set; }

    public List<string> SizePreferences { get; set; } = new();

    [Required(ErrorMessage = "Please choose how long you could foster for.")]
    [Display(Name = "Foster period")]
    public string FosterPeriod { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please tell us why you would like to foster.")]
    [Display(Name = "Why would you like to foster?")]
    [StringLength(1000)]
    public string Motivation { get; set; } = string.Empty;

    [Display(Name = "Terms and privacy policy")]
    public bool AgreeToTerms { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!AgreeToTerms)
        {
            yield return new ValidationResult(
                "Please agree to the terms and privacy policy to continue.",
                [nameof(AgreeToTerms)]);
        }

        if (!string.IsNullOrWhiteSpace(HomeType)
            && !FosterOptions.HomeTypes.Contains(HomeType))
        {
            yield return new ValidationResult(
                "Please choose one of the listed home types.",
                [nameof(HomeType)]);
        }

        if (!string.IsNullOrWhiteSpace(GardenFenced)
            && !FosterOptions.FencedAnswers.Contains(GardenFenced))
        {
            yield return new ValidationResult(
                "Please choose Yes, No or N/A.",
                [nameof(GardenFenced)]);
        }

        if (SizePreferences == null || SizePreferences.Count == 0)
        {
            yield return new ValidationResult(
                "Please choose at least one dog size.",
                [nameof(SizePreferences)]);
        }
        else if (SizePreferences.Count > FosterOptions.SizePreferences.Length
            || SizePreferences.Distinct().Count() != SizePreferences.Count
            || SizePreferences.Any(x => !FosterOptions.SizePreferences.Contains(x)))
        {
            yield return new ValidationResult(
                "Please choose from the listed dog sizes.",
                [nameof(SizePreferences)]);
        }

        if (!string.IsNullOrWhiteSpace(FosterPeriod)
            && !FosterPeriods.All.Contains(FosterPeriod))
        {
            yield return new ValidationResult(
                "Please choose one of the listed foster periods.",
                [nameof(FosterPeriod)]);
        }
    }
}
