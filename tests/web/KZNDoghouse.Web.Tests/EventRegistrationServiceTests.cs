using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;

namespace KZNDoghouse.Web.Tests;

public class EventRegistrationServiceTests
{
    [Fact]
    public async Task RegisterAsync_AcceptsApplicationWithoutAdvanceAvailability()
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
            assignmentRepository.Object,
            notifications.Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.True(result.Success);
        Assert.NotNull(result.Assignment);
        Assert.Equal(EventAssignmentStatuses.Pending, result.Assignment.Status);
    }

    [Fact]
    public async Task RegisterAsync_AllowsApplicationsForEventsSpanningSeveralTimePeriods()
    {
        var eventId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(9);
        var volunteerEnd = start.Date.AddHours(18);

        var eventRepository = EventRepository(eventId, start, volunteerEnd, maxVolunteers: 6);
        var assignments = EmptyAssignmentRepository(eventId, profileId);
        assignments.Setup(x => x.CreateAsync(It.IsAny<EventAssignment>()))
            .ReturnsAsync((EventAssignment assignment) => assignment);

        var service = new EventRegistrationService(
            eventRepository.Object,
            assignments.Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.True(result.Success);
        Assert.Equal(EventAssignmentStatuses.Pending, result.Assignment?.Status);
    }

    [Fact]
    public async Task RegisterAsync_AcceptsApplicationEvenWhenPlacesAreFilled()
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
        assignmentRepository
            .Setup(x => x.CreateAsync(It.IsAny<EventAssignment>()))
            .ReturnsAsync((EventAssignment assignment) => assignment);

        var service = new EventRegistrationService(
            eventRepository.Object,
            assignmentRepository.Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.True(result.Success);
        assignmentRepository.Verify(
            x => x.CreateAsync(It.Is<EventAssignment>(a =>
                a.Status == EventAssignmentStatuses.Pending)),
            Times.Once);
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
            new Mock<IEventAssignmentRepository>().Object,
            new Mock<INotificationService>().Object);

        var result = await service.RegisterAsync(eventId, profileId);

        Assert.False(result.Success);
        Assert.Contains("not enabled", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(EventAssignmentStatuses.Confirmed)]
    [InlineData(EventAssignmentStatuses.Reserve)]
    [InlineData(EventAssignmentStatuses.Declined)]
    public async Task ReviewAsync_SendsNotificationOnlyWhenStatusChanges(string status)
    {
        var eventId = Guid.NewGuid();
        var volunteerId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(5).AddHours(10);
        var eventRepository = EventRepository(eventId, start, start.AddHours(3), 5);
        var assignment = new EventAssignment
        {
            Id = assignmentId,
            EventId = eventId,
            ProfileId = volunteerId,
            Status = EventAssignmentStatuses.Pending
        };
        var assignments = new Mock<IEventAssignmentRepository>();
        assignments.Setup(x => x.GetByIdAsync(assignmentId)).ReturnsAsync(assignment);
        assignments.Setup(x => x.ReviewStatusAsync(assignmentId, status)).ReturnsAsync(true);
        var notifications = new Mock<INotificationService>();
        var service = new EventRegistrationService(
            eventRepository.Object,
            assignments.Object,
            notifications.Object);

        var result = await service.ReviewAsync(assignmentId, status);

        Assert.True(result.Success);
        Assert.Equal(status, result.Assignment?.Status);
        notifications.Verify(x => x.NotifyUserAsync(
            volunteerId, NotificationCategories.Calendar,
            It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task ReviewAsync_DoesNotNotifyOnRepeatedDecision()
    {
        var eventId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(10);
        var repository = new Mock<IEventAssignmentRepository>();
        repository.Setup(x => x.GetByIdAsync(assignmentId)).ReturnsAsync(new EventAssignment
        {
            Id = assignmentId, EventId = eventId,
            ProfileId = Guid.NewGuid(), Status = EventAssignmentStatuses.Confirmed
        });
        repository.Setup(x => x.ReviewStatusAsync(assignmentId, EventAssignmentStatuses.Confirmed))
            .ReturnsAsync(false);
        var notifications = new Mock<INotificationService>();
        var service = new EventRegistrationService(
            EventRepository(eventId, start, start.AddHours(2), 5).Object,
            repository.Object, notifications.Object);

        var result = await service.ReviewAsync(assignmentId, EventAssignmentStatuses.Confirmed);

        Assert.True(result.Success);
        notifications.Verify(x => x.NotifyUserAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Never);
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

}
