using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace KZNDoghouse.Web.Models;

public class ResetCodeViewModel
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter the code from your email.")]
    [RegularExpression(
        @"^\s*\d{6,10}\s*$",
        ErrorMessage = "The code is the 6 to 10 digit number in your email.")]
    [Display(Name = "Verification code")]
    public string Code { get; set; } = string.Empty;

    [BindNever]
    public int ResendAvailableInSeconds { get; set; }
}