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

public static class AuthorizationPolicies
{
    public const string PortalAccess = "PortalAccess";
}