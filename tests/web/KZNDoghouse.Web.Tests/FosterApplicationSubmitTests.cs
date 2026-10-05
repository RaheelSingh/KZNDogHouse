using KZNDoghouse.Web.Helpers;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class FosterApplicationSubmitTests
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

    private static FosterApplicationService CreateService(Mock<IFosterApplicationRepository> repository)
    {
        return new FosterApplicationService(
            repository.Object,
            new Mock<IFosteringService>().Object,
            new Mock<INotificationService>().Object);
    }

    [Fact]
    public void Build_WritesEveryAnswer_IntoTheDetailsText()
    {
        var text = FosterApplicationDetailsBuilder.Build(ValidForm());

        Assert.Contains("Home address: 1 Main Road, Durban", text);
        Assert.Contains("Type of home: House with garden", text);
        Assert.Contains("Garden fully fenced: Yes", text);
        Assert.Contains("Grass or daily walks on grass: Yes", text);
        Assert.Contains("Someone home day and night: Yes", text);
        Assert.Contains("Indoor sleeping area: Yes", text);
        Assert.Contains("Other pets: No", text);
        Assert.Contains("Children in the household: Yes", text);
        Assert.Contains("Dog sizes: Small, Medium", text);
        Assert.Contains("Foster period: 2–4 weeks", text);
        Assert.EndsWith("I love dogs.", text);
    }

    [Fact]
    public async Task SubmitAsync_SavesApplication_LinkedToTheApplicant()
    {
        var repository = new Mock<IFosterApplicationRepository>();
        FosterApplication? saved = null;

        repository
            .Setup(x => x.GetByApplicantAsync(It.IsAny<Guid>()))
            .ReturnsAsync(new List<FosterApplication>());

        repository
            .Setup(x => x.CreateAsync(It.IsAny<FosterApplication>()))
            .Callback<FosterApplication>(a => saved = a)
            .ReturnsAsync((FosterApplication a) => a);

        var profileId = Guid.NewGuid();
        var dogId = Guid.NewGuid();
        var form = ValidForm();
        form.DogId = dogId;
        form.FirstName = " Jane ";
        form.Email = " jane@example.com ";

        var result = await CreateService(repository).SubmitAsync(form, profileId);

        Assert.True(result.Success);
        Assert.NotNull(saved);
        Assert.NotEqual(Guid.Empty, saved!.Id);
        Assert.Equal(profileId, saved.ApplicantUserId);
        Assert.Equal("Jane Smith", saved.ApplicantName);
        Assert.Equal("jane@example.com", saved.ApplicantEmail);
        Assert.Equal("031 123 4567", saved.ApplicantPhone);
        Assert.Equal(dogId, saved.DogId);
        Assert.Equal("Submitted", saved.Status);
        Assert.True((DateTime.UtcNow - saved.SubmittedAt).TotalSeconds < 5);
        Assert.Null(saved.ReviewedByStaffId);
        Assert.Null(saved.RejectionReason);
        Assert.Contains("Garden fully fenced: Yes", saved.ApplicationDetails);
    }

    [Fact]
    public async Task SubmitAsync_SavesApplication_WithoutADog_WhenNoneWasChosen()
    {
        var repository = new Mock<IFosterApplicationRepository>();
        FosterApplication? saved = null;

        repository
            .Setup(x => x.GetByApplicantAsync(It.IsAny<Guid>()))
            .ReturnsAsync(new List<FosterApplication>());

        repository
            .Setup(x => x.CreateAsync(It.IsAny<FosterApplication>()))
            .Callback<FosterApplication>(a => saved = a)
            .ReturnsAsync((FosterApplication a) => a);

        var result = await CreateService(repository).SubmitAsync(ValidForm(), Guid.NewGuid());

        Assert.True(result.Success);
        Assert.Null(saved!.DogId);
    }

    [Theory]
    [InlineData("Submitted")]
    [InlineData("Under Review")]
    public async Task SubmitAsync_Fails_WhenApplicantAlreadyHasAnOpenApplication(string status)
    {
        var repository = new Mock<IFosterApplicationRepository>();

        repository
            .Setup(x => x.GetByApplicantAsync(It.IsAny<Guid>()))
            .ReturnsAsync(new List<FosterApplication> { new() { Status = status } });

        var result = await CreateService(repository).SubmitAsync(ValidForm(), Guid.NewGuid());

        Assert.False(result.Success);
        repository.Verify(x => x.CreateAsync(It.IsAny<FosterApplication>()), Times.Never);
    }

    [Theory]
    [InlineData("Approved")]
    [InlineData("Rejected")]
    public async Task SubmitAsync_Succeeds_WhenPreviousApplicationsAreClosed(string status)
    {
        var repository = new Mock<IFosterApplicationRepository>();

        repository
            .Setup(x => x.GetByApplicantAsync(It.IsAny<Guid>()))
            .ReturnsAsync(new List<FosterApplication> { new() { Status = status } });

        repository
            .Setup(x => x.CreateAsync(It.IsAny<FosterApplication>()))
            .ReturnsAsync((FosterApplication a) => a);

        var result = await CreateService(repository).SubmitAsync(ValidForm(), Guid.NewGuid());

        Assert.True(result.Success);
        repository.Verify(x => x.CreateAsync(It.IsAny<FosterApplication>()), Times.Once);
    }
}
