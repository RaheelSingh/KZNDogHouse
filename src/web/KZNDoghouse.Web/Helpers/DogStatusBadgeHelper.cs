using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Helpers;

public static class DogStatusBadgeHelper
{
    public static string CssClassFor(string status)
    {
        return status switch
        {
            DogStatuses.Available => "kzn-status-available",
            DogStatuses.InCare => "kzn-status-in-care",
            DogStatuses.UnderTreatment => "kzn-status-under-treatment",
            DogStatuses.Fostered => "kzn-status-fostered",
            DogStatuses.Reserved => "kzn-status-reserved",
            DogStatuses.Adopted => "kzn-status-adopted",
            _ => "kzn-status-in-care"
        };
    }
}