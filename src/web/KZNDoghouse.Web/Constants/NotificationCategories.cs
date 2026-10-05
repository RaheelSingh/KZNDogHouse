namespace KZNDoghouse.Web.Constants;

public static class NotificationCategories
{
    public const string Medical = "Medical";
    public const string Calendar = "Calendar";
    public const string Tasks = "Tasks";
    public const string Messages = "Messages";
    public const string General = "General";

    public static readonly string[] All =
    [
        Medical, Calendar, Tasks, Messages, General
    ];
}