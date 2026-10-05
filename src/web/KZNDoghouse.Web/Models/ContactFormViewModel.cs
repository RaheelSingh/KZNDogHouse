using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Models;

public class ContactFormViewModel : IValidatableObject
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

    [Display(Name = "Phone number (optional)")]
    [StringLength(25)]
    [RegularExpression(
        @"^(?=(?:\D*\d){8,15}\D*$)\+?[0-9(][0-9\s\-()]*$",
        ErrorMessage = "Enter a valid phone number, for example 031 123 4567.")]
    public string? Phone { get; set; }

    [Required(ErrorMessage = "Please tell us what this is about.")]
    [Display(Name = "What's this about?")]
    public string Topic { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please tell us a bit more about what you need.")]
    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Website { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!string.IsNullOrWhiteSpace(Topic)
            && !ContactTopics.All.Contains(Topic))
        {
            yield return new ValidationResult(
                "Please choose one of the listed topics.",
                [nameof(Topic)]);
        }
    }
}
