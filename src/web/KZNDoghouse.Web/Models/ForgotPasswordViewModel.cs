using System.ComponentModel.DataAnnotations;

namespace KZNDoghouse.Web.Models;

public class ForgotPasswordViewModel
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(150)]
    public string Email { get; set; } = string.Empty;
}