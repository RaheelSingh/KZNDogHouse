using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;

namespace KZNDoghouse.Web.Tests;

public class AvailabilityServiceTests
{
    [Fact]
    public async Task SubmitAsync_CreatesPendingAvailability_WithMondayWeekStart()
    {
        var volunteerId = Guid.NewGuid();
        var day = DateTime.UtcNow.Date.AddDays(5);

        var repository = new Mock<IAvailabilitySlotRepository>();
        repository
            .Setup(x => x.GetForVolunteerAsync(volunteerId))
            .ReturnsAsync(Array.Empty<AvailabilitySlot>());

        repository
            .Setup(x => x.CreateAsync(It.IsAny<AvailabilitySlot>()))
            .ReturnsAsync((AvailabilitySlot slot) => slot);

        var notifications = new Mock<INotificationService>();
        notifications
            .Setup(x => x.NotifyActiveRoleAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var service = new AvailabilityService(
            repository.Object,
            notifications.Object);

        var result = await service.SubmitAsync(
            volunteerId,
            day,
            AvailabilitySlotNames.Morning);

        Assert.True(result.Success);
        Assert.NotNull(result.Slot);
        Assert.Equal(AvailabilitySlotStatuses.Pending, result.Slot.Status);
        Assert.Equal(DayOfWeek.Monday, result.Slot.WeekStart.DayOfWeek);
        Assert.Equal(day, result.Slot.DayDate);
    }

    [Fact]
    public async Task SubmitAsync_RejectsDuplicatePendingSlot()
    {
        var volunteerId = Guid.NewGuid();
        var day = DateTime.UtcNow.Date.AddDays(3);

        var repository = new Mock<IAvailabilitySlotRepository>();
        repository
            .Setup(x => x.GetForVolunteerAsync(volunteerId))
            .ReturnsAsync(
                new[]
                {
                    new AvailabilitySlot
                {
                    Id = Guid.NewGuid(),
                    VolunteerId = volunteerId,
                    DayDate = day,
                    Slot = AvailabilitySlotNames.Evening,
                    Status = AvailabilitySlotStatuses.Pending
                    }
                });

        var service = new AvailabilityService(
            repository.Object,
            new Mock<INotificationService>().Object);

        var result = await service.SubmitAsync(
            volunteerId,
            day,
            AvailabilitySlotNames.Evening);

        Assert.False(result.Success);
        repository.Verify(
            x => x.CreateAsync(It.IsAny<AvailabilitySlot>()),
            Times.Never);
    }
}
