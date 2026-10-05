using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Models;

namespace KZNDoghouse.Web.DTOs;

public class MobileDogDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string? Size { get; set; }
    public string Age { get; set; } = string.Empty;
    public string? About { get; set; }
    public string Status { get; set; } = string.Empty;
    public string StatusLabel { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public IReadOnlyList<string> ImageUrls { get; set; } = Array.Empty<string>();

    public static MobileDogDto FromPublicDog(PublicDogListItem dog) => new()
    {
        Id = dog.Id,
        Name = dog.Name,
        Gender = dog.Gender,
        Size = dog.Size,
        Age = dog.ShortAgeText,
        About = dog.About,
        Status = dog.Status,
        StatusLabel = dog.StatusLabel,
        PhotoUrl = dog.PhotoUrl,
        ImageUrls = dog.ImageUrls
    };
}

public class MobileEventDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Location { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string Visibility { get; set; } = string.Empty;
    public Guid? DogId { get; set; }
    public string? ImageUrl { get; set; }

    public static MobileEventDto FromEvent(CalendarEvent calendarEvent) => new()
    {
        Id = calendarEvent.Id,
        Title = calendarEvent.Title,
        Category = calendarEvent.Category,
        Description = calendarEvent.Description,
        Location = calendarEvent.Location,
        StartAt = calendarEvent.StartAt,
        EndAt = calendarEvent.EndAt,
        Visibility = calendarEvent.Visibility,
        DogId = calendarEvent.DogId,
        ImageUrl = calendarEvent.ImageUrl
    };
}

public class MobileAvailabilityDto
{
    public Guid Id { get; set; }
    public DateTime WeekStart { get; set; }
    public DateTime DayDate { get; set; }
    public string Slot { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public static MobileAvailabilityDto FromSlot(AvailabilitySlot slot) => new()
    {
        Id = slot.Id,
        WeekStart = slot.WeekStart,
        DayDate = slot.DayDate,
        Slot = slot.Slot,
        Status = slot.Status,
        SubmittedAt = slot.SubmittedAt,
        ReviewedAt = slot.ReviewedAt
    };
}

public class SubmitAvailabilityDto
{
    [Required]
    public DateTime DayDate { get; set; }

    [Required]
    [StringLength(30)]
    public string Slot { get; set; } = string.Empty;
}

public class MobileNotificationDto
{
    public Guid Id { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    public static MobileNotificationDto FromNotification(AppNotification notification) => new()
    {
        Id = notification.Id,
        Category = notification.Category,
        Title = notification.Title,
        Body = notification.Body,
        IsRead = notification.IsRead,
        CreatedAt = notification.CreatedAt
    };
}

public class MobileEventRegistrationDto
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public static MobileEventRegistrationDto FromAssignment(EventAssignment assignment) => new()
    {
        Id = assignment.Id,
        EventId = assignment.EventId,
        Status = assignment.Status,
        CreatedAt = assignment.CreatedAt
    };
}
