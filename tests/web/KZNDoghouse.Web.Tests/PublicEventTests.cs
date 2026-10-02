using System.Globalization;
using KZNDoghouse.Web.Helpers;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class PublicEventTests
{
    private static DateTime Parse(string value) =>
        DateTime.Parse(value, CultureInfo.InvariantCulture);

    [Theory]
    [InlineData("2026-07-15 09:00", "2026-07-15 13:00", "9am–1pm")]
    [InlineData("2026-07-15 09:30", "2026-07-15 11:45", "9:30am–11:45am")]
    [InlineData("2026-07-15 09:00", null, "9am")]
    [InlineData("2026-07-15 12:00", "2026-07-15 15:00", "12pm–3pm")]
    [InlineData("2026-07-15 12:30", null, "12:30pm")]
    [InlineData("2026-07-15 00:00", null, "12am")]
    [InlineData("2026-07-15 00:15", null, "12:15am")]
    [InlineData("2026-07-15 23:59", null, "11:59pm")]
    [InlineData("2026-07-15 18:00", "2026-07-16 02:00", "6pm")]
    [InlineData("2026-07-15 09:00", "2026-07-15 08:00", "9am")]
    [InlineData("2026-07-15 09:00", "2026-07-15 09:00", "9am")]
    public void FormatTimeRange_ShowsStartAndSameDayEndTimes(string start, string? end, string expected)
    {
        var result = EventTimeHelper.FormatTimeRange(
            Parse(start),
            end == null ? null : Parse(end));

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("de-DE")]
    [InlineData("fr-FR")]
    [InlineData("af-ZA")]
    [InlineData("ar-SA")]
    public void EventItem_FormatsText_RegardlessOfServerCulture(string culture)
    {
        var original = CultureInfo.CurrentCulture;

        try
        {
            CultureInfo.CurrentCulture = new CultureInfo(culture);

            var item = PublicEventItem.FromEvent(new CalendarEvent
            {
                Title = "Adoption Day",
                Category = "Public Event",
                StartAt = new DateTime(2026, 7, 5, 9, 0, 0),
                EndAt = new DateTime(2026, 7, 5, 13, 0, 0)
            });

            Assert.Equal("Sun, 5 July", item.DateText);
            Assert.Equal("Jul", item.MonthText);
            Assert.Equal("05", item.DayText);
            Assert.Equal("5 Jul 2026", item.FullDateText);
            Assert.Equal("9am–1pm", item.TimeText);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void EventItem_DoesNotExposeInternalFields()
    {
        var exposed = typeof(PublicEventItem).GetProperties().Select(x => x.Name).ToArray();

        Assert.DoesNotContain("DogId", exposed);
        Assert.DoesNotContain("CreatedBy", exposed);
        Assert.DoesNotContain("Visibility", exposed);
    }

    private static List<PublicEventItem> SampleItems() => new()
    {
        new() { Title = "A", Category = "Public Event" },
        new() { Title = "B", Category = "Meeting" },
        new() { Title = "C", Category = "public event" }
    };

    private static readonly string[] Categories = ["Meeting", "Public Event"];

    [Fact]
    public void Apply_ReturnsEverything_WhenNoCategoryIsChosen()
    {
        var filter = PublicEventFilter.Create(null, Categories);

        Assert.Equal(3, filter.Apply(SampleItems()).Count);
    }

    [Fact]
    public void Apply_FiltersByCategory_IgnoringCase()
    {
        var filter = PublicEventFilter.Create("PUBLIC EVENT", Categories);

        Assert.Equal("Public Event", filter.Category);
        Assert.Equal(2, filter.Apply(SampleItems()).Count);
    }

    [Theory]
    [InlineData("Bogus")]
    [InlineData("<script>")]
    [InlineData("")]
    [InlineData("Shift")]
    public void Create_IgnoresCategoriesThatAreNotAvailable(string category)
    {
        var filter = PublicEventFilter.Create(category, Categories);

        Assert.Null(filter.Category);
        Assert.False(filter.IsActive);
        Assert.Equal(3, filter.Apply(SampleItems()).Count);
    }

    private static CalendarEventService CreateService(List<CalendarEvent> events)
    {
        var repository = new Mock<ICalendarEventRepository>();

        repository.Setup(x => x.GetAllAsync()).ReturnsAsync(events);

        return new CalendarEventService(
            repository.Object,
            new Mock<INotificationService>().Object);
    }

    private static List<CalendarEvent> SampleEvents() => new()
    {
        new() { Title = "FuturePublic", Visibility = "Public", StartAt = DateTime.UtcNow.AddDays(5) },
        new() { Title = "FutureInternal", Visibility = "Internal", StartAt = DateTime.UtcNow.AddDays(5) },
        new() { Title = "PastPublicOld", Visibility = "Public", StartAt = DateTime.UtcNow.AddDays(-30) },
        new() { Title = "PastPublicNew", Visibility = "Public", StartAt = DateTime.UtcNow.AddDays(-2) },
        new() { Title = "PastInternal", Visibility = "Internal", StartAt = DateTime.UtcNow.AddDays(-2) }
    };

    [Fact]
    public async Task GetPublicUpcomingAsync_ReturnsOnlyPublicFutureEvents()
    {
        var result = await CreateService(SampleEvents()).GetPublicUpcomingAsync();

        Assert.Equal(new[] { "FuturePublic" }, result.Select(x => x.Title).ToArray());
    }

    [Fact]
    public async Task GetPublicPastAsync_ReturnsOnlyPublicPastEvents_NewestFirst()
    {
        var result = await CreateService(SampleEvents()).GetPublicPastAsync();

        Assert.Equal(
            new[] { "PastPublicNew", "PastPublicOld" },
            result.Select(x => x.Title).ToArray());
    }

    [Fact]
    public async Task UpcomingAndPastEvents_NeverOverlap()
    {
        var service = CreateService(SampleEvents());

        var upcoming = (await service.GetPublicUpcomingAsync()).Select(x => x.Title);
        var past = (await service.GetPublicPastAsync()).Select(x => x.Title);

        Assert.Empty(upcoming.Intersect(past));
    }
}
