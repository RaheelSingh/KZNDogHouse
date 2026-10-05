using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;

namespace KZNDoghouse.Web.Tests;

public class EventRegistrationServiceTests
{
    [Fact]
    public async Task RegisterAsync_AllowsVolunteerWhenEntireVolunteerWindowIsApproved()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(9);
        var volunteerEnd = start.Date.AddHours(14);

        var eventRepository = EventRepository(
            eventId,
            start,
            volunteerEnd,
            maxVolunteers: 6);

        var availabilityRepository = new Mock<IAvailabilitySlotRepository>();
        availabilityRepository
            .Setup(x => x.GetForVolunteerAsync(profileId))
            .ReturnsAsync(
                new[]
                {
                    Approved(profileId, start.Date, AvailabilitySlotNames.Morning),
                    Approved(profileId, start.Date, AvailabilitySlotNames.Afternoon)
                });

        var assignmentRepository = EmptyAssignmentRepository(eventId, profileId);
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
    public async Task RegisterAsync_RejectsVolunteerWhenPartOfVolunteerWindowIsNotApproved()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(9);
        var volunteerEnd = start.Date.AddHours(14);

        var eventRepository = EventRepository(
            eventId,
            start,
            volunteerEnd,
            maxVolunteers: 6);

        var availabilityRepository = new Mock<IAvailabilitySlotRepository>();
        availabilityRepository
            .Setup(x => x.GetForVolunteerAsync(profileId))
            .ReturnsAsync(
                new[]
                {
                    Approved(profileId, start.Date, AvailabilitySlotNames.Morning)
                });

        var assignmentRepository = new Mock<IEventAssignmentRepository>();

        var service = new EventRegistrationService(
            eventRepository.Object,
            availabilityRepository.Object,
            assignmentRepository.Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.False(result.Success);
        Assert.Contains("afternoon", result.Message, StringComparison.OrdinalIgnoreCase);
        assignmentRepository.Verify(
            x => x.CreateAsync(It.IsAny<EventAssignment>()),
            Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_RejectsWhenVolunteerCapacityIsFull()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(4).AddHours(10);
        var end = start.AddHours(1);

        var eventRepository = EventRepository(
            eventId,
            start,
            end,
            maxVolunteers: 1);

        var availabilityRepository = new Mock<IAvailabilitySlotRepository>();
        availabilityRepository
            .Setup(x => x.GetForVolunteerAsync(profileId))
            .ReturnsAsync(
                new[]
                {
                    Approved(profileId, start.Date, AvailabilitySlotNames.Morning)
                });

        var assignmentRepository = new Mock<IEventAssignmentRepository>();
        assignmentRepository
            .Setup(x => x.GetByEventAndProfileAsync(eventId, profileId))
            .ReturnsAsync((EventAssignment?)null);
        assignmentRepository
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(
                new[]
                {
                    new EventAssignment
                    {
                        EventId = eventId,
                        ProfileId = Guid.NewGuid(),
                        Status = EventAssignmentStatuses.Registered
                    }
                });

        var service = new EventRegistrationService(
            eventRepository.Object,
            availabilityRepository.Object,
            assignmentRepository.Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.False(result.Success);
        Assert.Contains("capacity", result.Message, StringComparison.OrdinalIgnoreCase);
        assignmentRepository.Verify(
            x => x.CreateAsync(It.IsAny<EventAssignment>()),
            Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_RejectsEventWithoutVolunteerSignupEnabled()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(2).AddHours(10);

        var eventRepository = new Mock<ICalendarEventRepository>();
        eventRepository
            .Setup(x => x.GetByIdAsync(eventId))
            .ReturnsAsync(new CalendarEvent
            {
                Id = eventId,
                Title = "Internal meeting",
                Category = EventCategories.Meeting,
                StartAt = start,
                VolunteerSignupEnabled = false
            });

        var service = new EventRegistrationService(
            eventRepository.Object,
            new Mock<IAvailabilitySlotRepository>().Object,
            new Mock<IEventAssignmentRepository>().Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.False(result.Success);
        Assert.Contains("not enabled", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static Mock<ICalendarEventRepository> EventRepository(
        Guid eventId,
        DateTime volunteerStart,
        DateTime volunteerEnd,
        int maxVolunteers)
    {
        var repository = new Mock<ICalendarEventRepository>();
        repository
            .Setup(x => x.GetByIdAsync(eventId))
            .ReturnsAsync(new CalendarEvent
            {
                Id = eventId,
                Title = "Community event",
                Category = EventCategories.PublicEvent,
                StartAt = volunteerStart,
                EndAt = volunteerEnd,
                VolunteerSignupEnabled = true,
                MaxVolunteers = maxVolunteers,
                VolunteerStartAt = volunteerStart,
                VolunteerEndAt = volunteerEnd
            });

        return repository;
    }

    private static Mock<IEventAssignmentRepository> EmptyAssignmentRepository(
        Guid eventId,
        Guid profileId)
    {
        var repository = new Mock<IEventAssignmentRepository>();
        repository
            .Setup(x => x.GetByEventAndProfileAsync(eventId, profileId))
            .ReturnsAsync((EventAssignment?)null);
        repository
            .Setup(x => x.GetAllAsync())
            .ReturnsAsync(Array.Empty<EventAssignment>());
        return repository;
    }

    private static AvailabilitySlot Approved(
        Guid profileId,
        DateTime day,
        string slot) => new()
    {
        VolunteerId = profileId,
        DayDate = day.Date,
        Slot = slot,
        Status = AvailabilitySlotStatuses.Approved
    };
}
