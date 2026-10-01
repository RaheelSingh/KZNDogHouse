using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class DogServiceTests
{
    [Fact]
    public async Task RegisterDogAsync_AssignsIdCreatedByAndCreatedAt()
    {
        var repository = new Mock<IDogRepository>();
        repository
            .Setup(x => x.CreateAsync(It.IsAny<Dog>()))
            .ReturnsAsync((Dog d) => d);

        var service = new DogService(repository.Object);

        var dog = new Dog { Name = "Rosie" };
        var createdByUserId = Guid.NewGuid();

        var result = await service.RegisterDogAsync(dog, createdByUserId);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(createdByUserId, result.CreatedBy);
        Assert.True(result.CreatedAt <= DateTime.UtcNow);
    }

    [Fact]
    public async Task ChangeStatusAsync_DelegatesToRepository()
    {
        var repository = new Mock<IDogRepository>();
        var service = new DogService(repository.Object);

        var dogId = Guid.NewGuid();

        await service.ChangeStatusAsync(dogId, "Adopted");

        repository.Verify(x => x.UpdateStatusAsync(dogId, "Adopted"), Times.Once);
    }
}