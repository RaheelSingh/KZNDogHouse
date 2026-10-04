using System.ComponentModel.DataAnnotations;

namespace KZNDoghouse.Web.Models;

public class RegisterViewModel
{
    [Required(ErrorMessage = "First name is required.")]
    [Display(Name = "First name")]
    [StringLength(50)]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    [Display(Name = "Last name")]
    [StringLength(50)]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [DataType(DataType.Password)]
    [StringLength(128, ErrorMessage = "Password cannot be longer than 128 characters.")]
    [RegularExpression(
        @"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$",
        ErrorMessage = "Password must be at least 8 characters and include an uppercase letter, a number and a special character.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please confirm your password.")]
    [DataType(DataType.Password)]
    [Display(Name = "Confirm password")]
    [Compare(
        nameof(Password),
        ErrorMessage = "The passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;

    [Display(Name = "I would like to volunteer with KZN Doghouse")]
    public bool WantsToVolunteer { get; set; }
}
