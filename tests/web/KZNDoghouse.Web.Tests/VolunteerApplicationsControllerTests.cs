using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Controllers;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace KZNDoghouse.Web.Tests;

public class VolunteerApplicationsControllerTests
{
    [Fact]
    public async Task Index_ReturnsEventApplications_IncludingReviewedOnes()
    {
        var eventId = Guid.NewGuid();
        var pendingVolunteerId = Guid.NewGuid();
        var confirmedVolunteerId = Guid.NewGuid();
        var calendarEvent = new CalendarEvent
        {
            Id = eventId,
            Title = "Shelter fundraiser",
            StartAt = DateTime.UtcNow.AddDays(4),
            VolunteerSignupEnabled = true,
            MaxVolunteers = 2
        };
        var assignments = new[]
        {
            new EventAssignment
            {
                Id = Guid.NewGuid(), EventId = eventId,
                ProfileId = pendingVolunteerId,
                Status = EventAssignmentStatuses.Pending,
                CreatedAt = DateTime.UtcNow
            },
            new EventAssignment
            {
                Id = Guid.NewGuid(), EventId = eventId,
                ProfileId = confirmedVolunteerId,
                Status = EventAssignmentStatuses.Confirmed,
                CreatedAt = DateTime.UtcNow.AddMinutes(-2)
            }
        };
        var profiles = new[]
        {
            new UserProfile { Id = pendingVolunteerId, FirstName = "Alex", LastName = "Smith" },
            new UserProfile { Id = confirmedVolunteerId, FirstName = "Sam", LastName = "Jones" }
        };

        var events = new Mock<ICalendarEventService>();
        events.Setup(x => x.GetAllAsync()).ReturnsAsync(new[] { calendarEvent });
        var applications = new Mock<IEventAssignmentRepository>();
        applications.Setup(x => x.GetAllAsync()).ReturnsAsync(assignments);
        var users = new Mock<IUserProfileRepository>();
        users.Setup(x => x.GetAllAsync()).ReturnsAsync(profiles);

        var controller = new AvailabilityController(
            events.Object,
            applications.Object,
            new Mock<IEventRegistrationService>().Object,
            users.Object,
            NullLogger<AvailabilityController>.Instance);

        var result = await controller.Index();
        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsAssignableFrom<IReadOnlyList<VolunteerApplicationListItem>>(view.Model);

        Assert.Equal(2, model.Count);
        Assert.Equal(EventAssignmentStatuses.Pending, model[0].Assignment.Status);
        Assert.Equal("Alex Smith", model[0].VolunteerName);
        Assert.Equal(1, model[0].ConfirmedCount);
        Assert.Contains(model, x => x.VolunteerName == "Sam Jones"
            && x.Assignment.Status == EventAssignmentStatuses.Confirmed);
    }
}
