using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Models;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class FosterApplicationFormTests
{
    private static FosterApplicationFormViewModel ValidForm() => new()
    {
        FirstName = "Jane",
        LastName = "Smith",
        Email = "jane@example.com",
        Phone = "031 123 4567",
        HomeAddress = "1 Main Road, Durban",
        HomeType = "House with garden",
        GardenFenced = "Yes",
        HasGrassOrDailyWalks = true,
        SomeoneHomeDayAndNight = true,
        HasIndoorSleepingArea = true,
        HasOtherPets = false,
        HasChildren = true,
        SizePreferences = new List<string> { "Small", "Medium" },
        FosterPeriod = "2–4 weeks",
        Motivation = "I love dogs.",
        AgreeToTerms = true
    };

    private static List<ValidationResult> Validate(FosterApplicationFormViewModel form)
    {
        var results = new List<ValidationResult>();

        Validator.TryValidateObject(form, new ValidationContext(form), results, true);

        return results;
    }

    private static bool HasErrorFor(List<ValidationResult> results, string member) =>
        results.Any(x => x.MemberNames.Contains(member));

    [Fact]
    public void Validate_AcceptsCompleteForm()
    {
        Assert.Empty(Validate(ValidForm()));
    }

    [Fact]
    public void Validate_AcceptsForm_WithoutChosenDog()
    {
        var form = ValidForm();
        form.DogId = null;

        Assert.Empty(Validate(form));
    }

    [Fact]
    public void Validate_RejectsMissingNames()
    {
        var form = ValidForm();
        form.FirstName = string.Empty;
        form.LastName = string.Empty;

        var results = Validate(form);

        Assert.True(HasErrorFor(results, nameof(form.FirstName)));
        Assert.True(HasErrorFor(results, nameof(form.LastName)));
    }

    [Fact]
    public void Validate_RejectsInvalidEmail()
    {
        var form = ValidForm();
        form.Email = "not-an-email";

        Assert.True(HasErrorFor(Validate(form), nameof(form.Email)));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("12")]
    [InlineData("<script>")]
    [InlineData("()))))))))")]
    [InlineData("1234567890123456789012")]
    public void Validate_RejectsInvalidPhoneNumbers(string phone)
    {
        var form = ValidForm();
        form.Phone = phone;

        Assert.True(HasErrorFor(Validate(form), nameof(form.Phone)));
    }

    [Theory]
    [InlineData("0311234567")]
    [InlineData("+27 31 123 4567")]
    [InlineData("(031) 123-4567")]
    [InlineData("031 123 4567")]
    public void Validate_AcceptsCommonPhoneFormats(string phone)
    {
        var form = ValidForm();
        form.Phone = phone;

        Assert.False(HasErrorFor(Validate(form), nameof(form.Phone)));
    }

    [Fact]
    public void Validate_RejectsMissingAddress()
    {
        var form = ValidForm();
        form.HomeAddress = string.Empty;

        Assert.True(HasErrorFor(Validate(form), nameof(form.HomeAddress)));
    }

    [Theory]
    [InlineData("Castle")]
    [InlineData("")]
    public void Validate_RejectsUnknownHomeType(string homeType)
    {
        var form = ValidForm();
        form.HomeType = homeType;

        Assert.True(HasErrorFor(Validate(form), nameof(form.HomeType)));
    }

    [Theory]
    [InlineData("Maybe")]
    [InlineData("")]
    public void Validate_RejectsUnknownFencedAnswer(string answer)
    {
        var form = ValidForm();
        form.GardenFenced = answer;

        Assert.True(HasErrorFor(Validate(form), nameof(form.GardenFenced)));
    }

    [Theory]
    [InlineData("Yes")]
    [InlineData("No")]
    [InlineData("N/A")]
    public void Validate_AcceptsEachFencedAnswer(string answer)
    {
        var form = ValidForm();
        form.GardenFenced = answer;

        Assert.False(HasErrorFor(Validate(form), nameof(form.GardenFenced)));
    }

    [Fact]
    public void Validate_RequiresEveryYesOrNoQuestion_ToBeAnswered()
    {
        var form = ValidForm();
        form.HasGrassOrDailyWalks = null;
        form.SomeoneHomeDayAndNight = null;
        form.HasIndoorSleepingArea = null;
        form.HasOtherPets = null;
        form.HasChildren = null;

        var results = Validate(form);

        Assert.True(HasErrorFor(results, nameof(form.HasGrassOrDailyWalks)));
        Assert.True(HasErrorFor(results, nameof(form.SomeoneHomeDayAndNight)));
        Assert.True(HasErrorFor(results, nameof(form.HasIndoorSleepingArea)));
        Assert.True(HasErrorFor(results, nameof(form.HasOtherPets)));
        Assert.True(HasErrorFor(results, nameof(form.HasChildren)));
    }

    [Fact]
    public void Validate_AcceptsNoAnswers_ToTheYesOrNoQuestions()
    {
        var form = ValidForm();
        form.HasGrassOrDailyWalks = false;
        form.HasOtherPets = false;
        form.HasChildren = false;

        Assert.Empty(Validate(form));
    }

    [Fact]
    public void Validate_RequiresAtLeastOneDogSize()
    {
        var form = ValidForm();
        form.SizePreferences = new List<string>();

        Assert.True(HasErrorFor(Validate(form), nameof(form.SizePreferences)));
    }

    [Fact]
    public void Validate_RejectsUnknownDogSize()
    {
        var form = ValidForm();
        form.SizePreferences = new List<string> { "Giant" };

        Assert.True(HasErrorFor(Validate(form), nameof(form.SizePreferences)));
    }

    [Fact]
    public void Validate_RejectsRepeatedDogSizes()
    {
        var form = ValidForm();
        form.SizePreferences = Enumerable.Repeat("Small", 500).ToList();

        Assert.True(HasErrorFor(Validate(form), nameof(form.SizePreferences)));
    }

    [Fact]
    public void Validate_AcceptsAllDogSizes()
    {
        var form = ValidForm();
        form.SizePreferences = new List<string> { "Small", "Medium", "Large", "No preference" };

        Assert.False(HasErrorFor(Validate(form), nameof(form.SizePreferences)));
    }

    [Theory]
    [InlineData("Forever")]
    [InlineData("")]
    public void Validate_RejectsUnknownFosterPeriod(string period)
    {
        var form = ValidForm();
        form.FosterPeriod = period;

        Assert.True(HasErrorFor(Validate(form), nameof(form.FosterPeriod)));
    }

    [Theory]
    [InlineData("A few days")]
    [InlineData("2–4 weeks")]
    [InlineData("Open-ended")]
    public void Validate_AcceptsEachFosterPeriod(string period)
    {
        var form = ValidForm();
        form.FosterPeriod = period;

        Assert.False(HasErrorFor(Validate(form), nameof(form.FosterPeriod)));
    }

    [Fact]
    public void Validate_RequiresMotivation_AndLimitsItsLength()
    {
        var form = ValidForm();
        form.Motivation = string.Empty;

        Assert.True(HasErrorFor(Validate(form), nameof(form.Motivation)));

        form.Motivation = new string('a', 1001);

        Assert.True(HasErrorFor(Validate(form), nameof(form.Motivation)));
    }

    [Fact]
    public void Validate_RequiresTermsToBeAccepted()
    {
        var form = ValidForm();
        form.AgreeToTerms = false;

        Assert.True(HasErrorFor(Validate(form), nameof(form.AgreeToTerms)));
    }
}
