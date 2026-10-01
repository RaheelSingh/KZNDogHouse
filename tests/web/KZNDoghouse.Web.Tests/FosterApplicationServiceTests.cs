using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class FosterApplicationServiceTests
{
    [Fact]
    public async Task ApproveAsync_Fails_WhenNoDogAssigned()
    {
        var applicationId = Guid.NewGuid();
        var application = new FosterApplication
        {
            Id = applicationId,
            ApplicantName = "Jane",
            ApplicantEmail = "jane@example.com",
            DogId = null
        };

        var applicationRepository = new Mock<IFosterApplicationRepository>();
        applicationRepository.Setup(x => x.GetByIdAsync(applicationId)).ReturnsAsync(application);

        var fosteringService = new Mock<IFosteringService>();
        var notificationService = new Mock<INotificationService>();

        var service = new FosterApplicationService(
            applicationRepository.Object, fosteringService.Object, notificationService.Object);

        var result = await service.ApproveAsync(applicationId, Guid.NewGuid());

        Assert.False(result.Success);
        fosteringService.Verify(
            x => x.StartFosteringAsync(
                It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<string>(), It.IsAny<Guid>()),
            Times.Never);
    }

    [Fact]
    public async Task ApproveAsync_NotifiesApplicant_WhenApplicantHasLinkedAccount()
    {
        var applicationId = Guid.NewGuid();
        var applicantUserId = Guid.NewGuid();
        var dogId = Guid.NewGuid();

        var application = new FosterApplication
        {
            Id = applicationId,
            ApplicantName = "Jane",
            ApplicantEmail = "jane@example.com",
            ApplicantUserId = applicantUserId,
            DogId = dogId
        };

        var applicationRepository = new Mock<IFosterApplicationRepository>();
        applicationRepository.Setup(x => x.GetByIdAsync(applicationId)).ReturnsAsync(application);

        var fosteringService = new Mock<IFosteringService>();
        fosteringService
            .Setup(x => x.StartFosteringAsync(dogId, applicantUserId, "Jane", It.IsAny<Guid>()))
            .ReturnsAsync(new FosteringRecord { Id = Guid.NewGuid() });

        var notificationService = new Mock<INotificationService>();

        var service = new FosterApplicationService(
            applicationRepository.Object, fosteringService.Object, notificationService.Object);

        await service.ApproveAsync(applicationId, Guid.NewGuid());

        notificationService.Verify(
            x => x.NotifyUserAsync(
                applicantUserId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()),
            Times.Once);
    }
}