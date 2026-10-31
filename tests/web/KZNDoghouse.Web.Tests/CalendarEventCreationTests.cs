using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;

namespace KZNDoghouse.Web.Tests;

public class CalendarEventCreationTests
{
    [Fact]
    public async Task CreateAsync_WithoutVolunteerSignup_ClearsVolunteerFields()
    {
        var repository = new Mock<ICalendarEventRepository>();
        repository.Setup(x => x.CreateAsync(It.IsAny<CalendarEvent>()))
            .ReturnsAsync((CalendarEvent e) => e);
        var service = new CalendarEventService(repository.Object);
        var start = DateTime.UtcNow.AddDays(5);

        var created = await service.CreateAsync(
            "Shelter meeting", EventCategories.Meeting, null, "KZN Doghouse",
            start, start.AddHours(1), EventVisibilities.Internal, null,
            false, 5, start, start.AddHours(1), "Old instructions", Guid.NewGuid());

        Assert.False(created.VolunteerSignupEnabled);
        Assert.Null(created.MaxVolunteers);
        Assert.Null(created.VolunteerStartAt);
        Assert.Null(created.VolunteerEndAt);
        Assert.Null(created.VolunteerNotes);
        repository.Verify(x => x.CreateAsync(It.IsAny<CalendarEvent>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WithVolunteers_PreservesShiftAndCapacity()
    {
        var repository = new Mock<ICalendarEventRepository>();
        repository.Setup(x => x.CreateAsync(It.IsAny<CalendarEvent>()))
            .ReturnsAsync((CalendarEvent e) => e);
        var service = new CalendarEventService(repository.Object);
        var start = DateTime.UtcNow.AddDays(7);
        var arrival = start.AddHours(-1);
        var departure = start.AddHours(3);

        var created = await service.CreateAsync(
            "Adoption day", EventCategories.PublicEvent, null, null,
            start, start.AddHours(2), EventVisibilities.Public, null,
            true, 3, arrival, departure, "Bring ID", Guid.NewGuid());

        Assert.True(created.VolunteerSignupEnabled);
        Assert.Equal(3, created.MaxVolunteers);
        Assert.Equal(arrival, created.VolunteerStartAt);
        Assert.Equal(departure, created.VolunteerEndAt);
        repository.Verify(x => x.CreateAsync(It.IsAny<CalendarEvent>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_RejectsMissingShift_WhenVolunteersAreEnabled()
    {
        var repository = new Mock<ICalendarEventRepository>();
        var service = new CalendarEventService(repository.Object);
        var start = DateTime.UtcNow.AddDays(7);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(
            "Adoption day", EventCategories.PublicEvent, null, null,
            start, start.AddHours(2), EventVisibilities.Public, null,
            true, 5, null, null, null, Guid.NewGuid()));

        repository.Verify(x => x.CreateAsync(It.IsAny<CalendarEvent>()), Times.Never);
    }
}
