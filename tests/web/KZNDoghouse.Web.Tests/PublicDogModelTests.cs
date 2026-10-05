using System.Globalization;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Helpers;
using KZNDoghouse.Web.Models;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class PublicDogModelTests
{
    private static readonly DateTime Today = new(2026, 10, 1);

    [Theory]
    [InlineData("2026-09-20", null, "0 months")]
    [InlineData("2026-09-01", null, "1 month")]
    [InlineData("2026-08-01", null, "2 months")]
    [InlineData("2025-10-02", null, "11 months")]
    [InlineData("2025-10-01", null, "1 year")]
    [InlineData("2022-03-15", null, "4 years")]
    [InlineData("2027-01-01", null, "0 months")]
    [InlineData(null, 3, "3 years")]
    [InlineData(null, 1, "1 year")]
    [InlineData(null, 0, "Under 1 year")]
    [InlineData(null, null, "Age unknown")]
    public void Describe_ReturnsLongAgeText(string? dateOfBirth, int? estimatedYears, string expected)
    {
        DateTime? born = dateOfBirth == null
            ? null
            : DateTime.Parse(dateOfBirth, CultureInfo.InvariantCulture);

        var result = DogAgeHelper.Describe(born, estimatedYears, Today);

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("2026-02-01", null, "8 mo")]
    [InlineData("2026-09-01", null, "1 mo")]
    [InlineData("2025-09-01", null, "1 yr")]
    [InlineData("2024-03-15", null, "2 yrs")]
    [InlineData(null, 3, "3 yrs")]
    [InlineData(null, 0, "Under 1 yr")]
    [InlineData(null, null, "Age unknown")]
    public void Describe_ReturnsShortAgeText(string? dateOfBirth, int? estimatedYears, string expected)
    {
        DateTime? born = dateOfBirth == null
            ? null
            : DateTime.Parse(dateOfBirth, CultureInfo.InvariantCulture);

        var result = DogAgeHelper.Describe(born, estimatedYears, Today, shortForm: true);

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Rocco", "R")]
    [InlineData("  max ", "M")]
    [InlineData("", "?")]
    [InlineData("   ", "?")]
    public void Initial_NeverFails_ForAnyName(string name, string expected)
    {
        Assert.Equal(expected, PublicDogStatusHelper.InitialOf(name));
        Assert.Equal(expected, new PublicDogListItem { Name = name }.Initial);
        Assert.Equal(expected, new PublicDogDetails { Name = name }.Initial);
    }

    [Theory]
    [InlineData(DogStatuses.Available, true)]
    [InlineData(DogStatuses.Fostered, true)]
    [InlineData(DogStatuses.Adopted, false)]
    [InlineData(DogStatuses.InCare, false)]
    [InlineData(DogStatuses.UnderTreatment, false)]
    [InlineData(DogStatuses.Reserved, false)]
    public void IsPublic_AllowsOnlyAvailableAndFostered(string status, bool expected)
    {
        Assert.Equal(expected, PublicDogStatusHelper.IsPublic(status));
    }

    [Fact]
    public void ListItem_BuildsMetaText_FromGenderAgeAndSize()
    {
        var dog = new Dog
        {
            Name = "Rocco",
            Gender = DogGenders.Male,
            EstimatedAgeYears = 2,
            Size = "Medium"
        };

        var item = PublicDogListItem.FromDog(dog);

        Assert.Equal("Male · 2 yrs · Medium", item.MetaText);
    }

    [Fact]
    public void ListItem_OmitsUnknownGenderAndMissingSize_FromMetaText()
    {
        var dog = new Dog
        {
            Name = "Bella",
            Gender = DogGenders.Unknown,
            EstimatedAgeYears = 1,
            Size = null
        };

        var item = PublicDogListItem.FromDog(dog);

        Assert.Equal("1 yr", item.MetaText);
    }

    [Fact]
    public void Details_BuildsMetaTextWithWeight_AndSinceText()
    {
        var dog = new Dog
        {
            Name = "Rocco",
            Gender = DogGenders.Male,
            EstimatedAgeYears = 2,
            Size = "Medium",
            WeightKg = 18m,
            IntakeDate = new DateTime(2026, 3, 9),
            Status = DogStatuses.Available
        };

        var details = PublicDogDetails.FromDog(dog);

        Assert.Equal("Male · 2 years · Medium (18kg)", details.MetaText);
        Assert.Equal("March 2026", details.SinceText);
        Assert.False(details.IsFostered);
    }

    [Fact]
    public void Details_ShowsFosteredStatus_ForFosteredDogs()
    {
        var details = PublicDogDetails.FromDog(new Dog
        {
            Name = "Poppy",
            Gender = DogGenders.Female,
            EstimatedAgeYears = 1,
            Size = "Small",
            WeightKg = 7.5m,
            Status = DogStatuses.Fostered
        });

        Assert.True(details.IsFostered);
        Assert.Equal("In foster care", details.StatusLabel);
        Assert.Equal("Female · 1 year · Small (7.5kg)", details.MetaText);
    }

    [Theory]
    [InlineData("de-DE")]
    [InlineData("fr-FR")]
    [InlineData("af-ZA")]
    [InlineData("ar-SA")]
    public void Details_FormatsText_RegardlessOfServerCulture(string culture)
    {
        var original = CultureInfo.CurrentCulture;

        try
        {
            CultureInfo.CurrentCulture = new CultureInfo(culture);

            var details = PublicDogDetails.FromDog(new Dog
            {
                Name = "Rocco",
                Gender = DogGenders.Male,
                EstimatedAgeYears = 2,
                Size = "Medium",
                WeightKg = 7.5m,
                IntakeDate = new DateTime(2026, 3, 9)
            });

            Assert.Equal("March 2026", details.SinceText);
            Assert.Equal("Male · 2 years · Medium (7.5kg)", details.MetaText);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void PublicModels_DoNotExposeInternalDogFields()
    {
        var internalFields = new[]
        {
            "KennelLocation", "IntakeType", "CreatedBy", "CreatedAt",
            "UpdatedAt", "EyeColour", "DateOfBirth"
        };

        var exposed = typeof(PublicDogListItem).GetProperties()
            .Concat(typeof(PublicDogDetails).GetProperties())
            .Select(x => x.Name)
            .ToArray();

        foreach (var field in internalFields)
        {
            Assert.DoesNotContain(field, exposed);
        }
    }
}
