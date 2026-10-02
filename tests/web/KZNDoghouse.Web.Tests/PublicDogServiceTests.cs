using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class PublicDogServiceTests
{
    [Fact]
    public async Task GetPublicDogsAsync_ReturnsAvailableAndFosteredDogs_NewestFirst()
    {
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByStatusAsync(DogStatuses.Available))
            .ReturnsAsync(new List<Dog>
            {
                new() { Name = "Old", Status = DogStatuses.Available, IntakeDate = new DateTime(2025, 1, 1) },
                new() { Name = "New", Status = DogStatuses.Available, IntakeDate = new DateTime(2026, 5, 1) }
            });

        repository
            .Setup(x => x.GetByStatusAsync(DogStatuses.Fostered))
            .ReturnsAsync(new List<Dog>
            {
                new() { Name = "Mid", Status = DogStatuses.Fostered, IntakeDate = new DateTime(2026, 1, 1) }
            });

        var service = new DogService(repository.Object);

        var result = await service.GetPublicDogsAsync();

        Assert.Equal(new[] { "New", "Mid", "Old" }, result.Select(x => x.Name).ToArray());
        Assert.True(result[1].IsFostered);
        Assert.Equal("In foster care", result[1].StatusLabel);
        Assert.Equal("Ready to adopt", result[0].StatusLabel);
    }

    [Fact]
    public async Task GetPublicDogsAsync_NeverQueriesNonPublicStatuses()
    {
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByStatusAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Dog>());

        var service = new DogService(repository.Object);

        await service.GetPublicDogsAsync();

        repository.Verify(x => x.GetByStatusAsync(DogStatuses.Available), Times.Once);
        repository.Verify(x => x.GetByStatusAsync(DogStatuses.Fostered), Times.Once);
        repository.Verify(x => x.GetByStatusAsync(DogStatuses.Adopted), Times.Never);
        repository.Verify(x => x.GetByStatusAsync(DogStatuses.InCare), Times.Never);
        repository.Verify(x => x.GetByStatusAsync(DogStatuses.UnderTreatment), Times.Never);
        repository.Verify(x => x.GetByStatusAsync(DogStatuses.Reserved), Times.Never);
    }

    [Fact]
    public async Task GetPublicDogsAsync_ReturnsEmptyList_WhenNoPublicDogsExist()
    {
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByStatusAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Dog>());

        var service = new DogService(repository.Object);

        var result = await service.GetPublicDogsAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPublicDogsAsync_Throws_WhenRepositoryFails()
    {
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByStatusAsync(DogStatuses.Available))
            .ThrowsAsync(new InvalidOperationException("Database unavailable."));

        repository
            .Setup(x => x.GetByStatusAsync(DogStatuses.Fostered))
            .ReturnsAsync(new List<Dog>());

        var service = new DogService(repository.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetPublicDogsAsync());
    }

    [Theory]
    [InlineData(DogStatuses.Available, true)]
    [InlineData(DogStatuses.Fostered, true)]
    [InlineData(DogStatuses.Adopted, false)]
    [InlineData(DogStatuses.InCare, false)]
    [InlineData(DogStatuses.UnderTreatment, false)]
    [InlineData(DogStatuses.Reserved, false)]
    public async Task GetPublicDogAsync_ReturnsDetails_OnlyForPublicStatuses(string status, bool expectedVisible)
    {
        var dogId = Guid.NewGuid();
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByIdAsync(dogId))
            .ReturnsAsync(new Dog { Id = dogId, Name = "Rocco", Status = status });

        var service = new DogService(repository.Object);

        var result = await service.GetPublicDogAsync(dogId);

        Assert.Equal(expectedVisible, result != null);
    }

    [Fact]
    public async Task GetPublicDogAsync_ReturnsNull_WhenDogDoesNotExist()
    {
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Dog?)null);

        var service = new DogService(repository.Object);

        var result = await service.GetPublicDogAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetPublicDogAsync_MapsDogDetails()
    {
        var dogId = Guid.NewGuid();
        var repository = new Mock<IDogRepository>();

        repository
            .Setup(x => x.GetByIdAsync(dogId))
            .ReturnsAsync(new Dog
            {
                Id = dogId,
                Name = "Rocco",
                Breed = "Mixed breed",
                Gender = DogGenders.Male,
                Size = "Medium",
                WeightKg = 18m,
                About = "A friendly dog.",
                IsVaccinated = true,
                Status = DogStatuses.Available,
                IntakeDate = new DateTime(2026, 3, 9)
            });

        var service = new DogService(repository.Object);

        var result = await service.GetPublicDogAsync(dogId);

        Assert.NotNull(result);
        Assert.Equal(dogId, result!.Id);
        Assert.Equal("Rocco", result.Name);
        Assert.Equal("Mixed breed", result.Breed);
        Assert.Equal(18m, result.WeightKg);
        Assert.True(result.IsVaccinated);
        Assert.Equal("March 2026", result.SinceText);
    }
}
