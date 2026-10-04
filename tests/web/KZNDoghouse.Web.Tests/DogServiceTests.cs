using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class DogServiceTests
{
    [Fact]
    public async Task RegisterDogAsync_UsesDatabaseGeneratedIdAndSetsAuditFields()
    {
        var repository = new Mock<IDogRepository>();
        var imageRepository = new Mock<IDogImageRepository>();

        var databaseId = Guid.NewGuid();

        repository
            .Setup(x => x.CreateAsync(It.IsAny<Dog>()))
            .ReturnsAsync((Dog d) =>
            {
                Assert.Equal(Guid.Empty, d.Id);

                return new Dog
                {
                    Id = databaseId,
                    Name = d.Name,
                    CreatedBy = d.CreatedBy,
                    CreatedAt = d.CreatedAt
                };
            });

        var service = new DogService(
            repository.Object,
            imageRepository.Object);

        var dog = new Dog
        {
            Name = "Rosie"
        };

        var createdByUserId = Guid.NewGuid();

        var result =
            await service.RegisterDogAsync(
                dog,
                createdByUserId);

        Assert.Equal(
            databaseId,
            result.Id);

        Assert.Equal(
            createdByUserId,
            result.CreatedBy);

        Assert.True(
            result.CreatedAt <= DateTime.UtcNow);
    }

    [Fact]
    public async Task ChangeStatusAsync_DelegatesToRepository()
    {
        var repository = new Mock<IDogRepository>();
        var imageRepository = new Mock<IDogImageRepository>();

        var service = new DogService(
            repository.Object,
            imageRepository.Object);

        var dogId = Guid.NewGuid();

        await service.ChangeStatusAsync(
            dogId,
            "Adopted");

        repository.Verify(
            x => x.UpdateStatusAsync(
                dogId,
                "Adopted"),
            Times.Once);
    }
}
