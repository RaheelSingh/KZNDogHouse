using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class FosteringServiceTests
{
    [Fact]
    public async Task StartFosteringAsync_SetsDogStatusToFostered()
    {
        var fosteringRepository =
            new Mock<IFosteringRecordRepository>();

        fosteringRepository
            .Setup(x =>
                x.CreateAsync(
                    It.IsAny<FosteringRecord>()))
            .ReturnsAsync(
                (FosteringRecord r) => r);

        var dogRepository =
            new Mock<IDogRepository>();

        var dogImageRepository =
            new Mock<IDogImageRepository>();

        var dogService = new DogService(
            dogRepository.Object,
            dogImageRepository.Object);

        var service = new FosteringService(
            fosteringRepository.Object,
            dogService);

        var dogId = Guid.NewGuid();

        await service.StartFosteringAsync(
            dogId,
            null,
            "Nomsa P.",
            Guid.NewGuid());

        dogRepository.Verify(
            x => x.UpdateStatusAsync(
                dogId,
                DogStatuses.Fostered),
            Times.Once);
    }

    [Fact]
    public async Task ReturnDogAsync_SetsDogStatusToAvailable()
    {
        var fosteringRepository =
            new Mock<IFosteringRecordRepository>();

        var dogRepository =
            new Mock<IDogRepository>();

        var dogImageRepository =
            new Mock<IDogImageRepository>();

        var dogService = new DogService(
            dogRepository.Object,
            dogImageRepository.Object);

        var service = new FosteringService(
            fosteringRepository.Object,
            dogService);

        var dogId = Guid.NewGuid();
        var recordId = Guid.NewGuid();

        await service.ReturnDogAsync(
            recordId,
            dogId,
            "Settled in well.");

        fosteringRepository.Verify(
            x => x.CompleteAsync(
                recordId,
                "Settled in well."),
            Times.Once);

        dogRepository.Verify(
            x => x.UpdateStatusAsync(
                dogId,
                DogStatuses.Available),
            Times.Once);
    }
}