using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class DogFormValidationTests
{
    [Fact]
    public void InvalidIntakeType_IsRejectedBeforePersistence()
    {
        var model = ValidModel();
        model.IntakeType = "Found-ish";

        var results = Validate(model);

        Assert.Contains(
            results,
            x => x.MemberNames.Contains(nameof(DogFormViewModel.IntakeType)));
    }

    [Fact]
    public void FutureIntakeDate_IsRejected()
    {
        var model = ValidModel();
        model.IntakeDate = DateTime.UtcNow.Date.AddDays(1);

        var results = Validate(model);

        Assert.Contains(
            results,
            x => x.MemberNames.Contains(nameof(DogFormViewModel.IntakeDate)));
    }

    [Fact]
    public void KnownIntakeType_PassesValidation()
    {
        var model = ValidModel();
        model.IntakeType = DogIntakeTypes.Rescued;

        var results = Validate(model);

        Assert.DoesNotContain(
            results,
            x => x.MemberNames.Contains(nameof(DogFormViewModel.IntakeType)));
    }

    private static DogFormViewModel ValidModel() => new()
    {
        Name = "Rosie",
        Gender = DogGenders.Unknown,
        IntakeDate = DateTime.UtcNow.Date,
        Status = DogStatuses.InCare
    };

    private static IReadOnlyList<ValidationResult> Validate(DogFormViewModel model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(
            model,
            new ValidationContext(model),
            results,
            validateAllProperties: true);
        return results;
    }
}
