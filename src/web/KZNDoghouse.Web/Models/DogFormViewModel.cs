using System.ComponentModel.DataAnnotations;

namespace KZNDoghouse.Web.Models;

public class DogFormViewModel
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Breed { get; set; }

    [Display(Name = "Date of birth")]
    [DataType(DataType.Date)]
    public DateTime? DateOfBirth { get; set; }

    [Display(Name = "Estimated age (years)")]
    [Range(0, 30)]
    public int? EstimatedAgeYears { get; set; }

    [Required]
    public string Gender { get; set; } = "Unknown";

    public string? Size { get; set; }

    [Display(Name = "Weight (kg)")]
    [Range(0, 120)]
    public decimal? WeightKg { get; set; }

    [Display(Name = "Eye colour")]
    public string? EyeColour { get; set; }

    public string? Temperament { get; set; }

    public string? About { get; set; }

    [Display(Name = "Kennel location")]
    public string? KennelLocation { get; set; }

    [Required]
    [Display(Name = "Intake date")]
    [DataType(DataType.Date)]
    public DateTime IntakeDate { get; set; } = DateTime.UtcNow.Date;

    [Display(Name = "Intake type")]
    public string? IntakeType { get; set; }

    [Required]
    public string Status { get; set; } = "In Care";

    [Display(Name = "Vaccinated")]
    public bool IsVaccinated { get; set; }
}