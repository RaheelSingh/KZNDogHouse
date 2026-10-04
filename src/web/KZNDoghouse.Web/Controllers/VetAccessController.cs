using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = UserRoles.Administrator)]
public class VetAccessController : Controller
{
    private readonly IVetAccessService _vetAccessService;

    public VetAccessController(
        IVetAccessService vetAccessService)
    {
        _vetAccessService = vetAccessService;
    }

    [HttpGet]
    public async Task<IActionResult> Manage(
        Guid profileId)
    {
        var model =
            await _vetAccessService
                .GetAdminAccessAsync(profileId);

        if (model == null)
        {
            TempData["ErrorMessage"] =
                "The selected account is not a Vet account.";

            return RedirectToAction(
                "Index",
                "UserAccess");
        }

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update(
        Guid profileId,
        Guid[]? dogIds)
    {
        var currentAuthUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(
                currentAuthUserId))
        {
            return Challenge();
        }

        var result =
            await _vetAccessService
                .UpdateAuthorizationsAsync(
                    profileId,
                    dogIds ?? Array.Empty<Guid>(),
                    currentAuthUserId);

        if (result.Success)
        {
            TempData["SuccessMessage"] =
                result.Message;
        }
        else
        {
            TempData["ErrorMessage"] =
                result.Message;
        }

        return RedirectToAction(
            nameof(Manage),
            new
            {
                profileId
            });
    }
}
