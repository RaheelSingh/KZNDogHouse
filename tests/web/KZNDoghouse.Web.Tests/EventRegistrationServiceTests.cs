using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;

namespace KZNDoghouse.Web.Tests;

public class EventRegistrationServiceTests
{
    [Fact]
    public async Task RegisterAsync_AllowsVolunteerWithMatchingApprovedAvailability()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(10);

        var eventRepository = new Mock<ICalendarEventRepository>();
        eventRepository
            .Setup(x => x.GetByIdAsync(eventId))
            .ReturnsAsync(new CalendarEvent
            {
                Id = eventId,
                Title = "Morning shelter shift",
                Category = EventCategories.Shift,
                StartAt = start
            });

        var availabilityRepository = new Mock<IAvailabilitySlotRepository>();
        availabilityRepository
            .Setup(x => x.GetForVolunteerAsync(profileId))
            .ReturnsAsync(
                new[]
                {
                    new AvailabilitySlot
                {
                    VolunteerId = profileId,
                    DayDate = start.Date,
                    Slot = AvailabilitySlotNames.Morning,
                    Status = AvailabilitySlotStatuses.Approved
                    }
                });

        var assignmentRepository = new Mock<IEventAssignmentRepository>();
        assignmentRepository
            .Setup(x => x.GetByEventAndProfileAsync(eventId, profileId))
            .ReturnsAsync((EventAssignment?)null);
        assignmentRepository
            .Setup(x => x.CreateAsync(It.IsAny<EventAssignment>()))
            .ReturnsAsync((EventAssignment assignment) => assignment);

        var notifications = new Mock<INotificationService>();
        notifications
            .Setup(x => x.NotifyUserAsync(
                profileId,
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var service = new EventRegistrationService(
            eventRepository.Object,
            availabilityRepository.Object,
            assignmentRepository.Object,
            notifications.Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.True(result.Success);
        Assert.NotNull(result.Assignment);
        Assert.Equal(EventAssignmentStatuses.Registered, result.Assignment.Status);
    }

    [Fact]
    public async Task RegisterAsync_RejectsVolunteerWithoutMatchingApprovedAvailability()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(18);

        var eventRepository = new Mock<ICalendarEventRepository>();
        eventRepository
            .Setup(x => x.GetByIdAsync(eventId))
            .ReturnsAsync(new CalendarEvent
            {
                Id = eventId,
                Title = "Evening event",
                Category = EventCategories.Shift,
                StartAt = start
            });

        var availabilityRepository = new Mock<IAvailabilitySlotRepository>();
        availabilityRepository
            .Setup(x => x.GetForVolunteerAsync(profileId))
            .ReturnsAsync(Array.Empty<AvailabilitySlot>());

        var assignmentRepository = new Mock<IEventAssignmentRepository>();

        var service = new EventRegistrationService(
            eventRepository.Object,
            availabilityRepository.Object,
            assignmentRepository.Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.False(result.Success);
        assignmentRepository.Verify(
            x => x.CreateAsync(It.IsAny<EventAssignment>()),
            Times.Never);
    }
}
