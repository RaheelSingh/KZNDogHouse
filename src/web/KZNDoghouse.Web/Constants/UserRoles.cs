namespace KZNDoghouse.Web.Constants;

public static class UserRoles
{
    public const string Public = "Public";
    public const string Volunteer = "Volunteer";
    public const string Staff = "Staff";
    public const string Administrator = "Administrator";
    public const string Vet = "Vet";

    public static readonly string[] All =
    [
        Public,
        Volunteer,
        Staff,
        Administrator,
        Vet
    ];
}

public static class VolunteerRequestStatuses
{
    public const string None = "None";
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";

    public static readonly string[] All =
    [
        None,
        Pending,
        Approved,
        Rejected
    ];
}

public static class AuthorizationPolicies
{
    public const string PortalAccess = "PortalAccess";
    public const string VetMedicalAccess = "VetMedicalAccess";
}

public static class RateLimitPolicies
{
    public const string Login = "LoginAttempts";
    public const string Register = "RegistrationAttempts";
    public const string Api = "ApiRequests";
}
