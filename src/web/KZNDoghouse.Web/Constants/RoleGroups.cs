namespace KZNDoghouse.Web.Constants;

public static class RoleGroups
{
    public static readonly string[] Internal =
    [
        UserRoles.Staff,
        UserRoles.Administrator,
        UserRoles.Vet
    ];

    public static readonly string[] StaffOrAdministrator =
    [
        UserRoles.Staff,
        UserRoles.Administrator
    ];
}