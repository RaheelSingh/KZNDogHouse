using System.ComponentModel.DataAnnotations;

namespace KZNDoghouse.Web.Models;

public class NewPasswordViewModel
{
    [Required]
    public string Ticket { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [DataType(DataType.Password)]
    [Display(Name = "New password")]
    [StringLength(128, ErrorMessage = "Password cannot be longer than 128 characters.")]
    [RegularExpression(
        @"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$",
        ErrorMessage = "Password must be at least 8 characters and include an uppercase letter, a number and a special character.")]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please confirm your password.")]
    [DataType(DataType.Password)]
    [Display(Name = "Confirm new password")]
    [Compare(
        nameof(NewPassword),
        ErrorMessage = "The passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;
}