using System.ComponentModel.DataAnnotations;

namespace KZNDoghouse.Web.Models;

public class LoginViewModel
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [DataType(DataType.Password)]
    [StringLength(128, ErrorMessage = "Password is too long.")]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "Remember me")]
    public bool RememberMe { get; set; }

    public string? ReturnUrl { get; set; }
}
