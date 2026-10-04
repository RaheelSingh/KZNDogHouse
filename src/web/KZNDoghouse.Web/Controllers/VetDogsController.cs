using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(
    Policy = AuthorizationPolicies.VetMedicalAccess)]
public class VetDogsController : Controller
{
    private readonly IVetAccessService _vetAccessService;

    public VetDogsController(
        IVetAccessService vetAccessService)
    {
        _vetAccessService = vetAccessService;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var authUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(
                authUserId))
        {
            return Challenge();
        }

        var dogs =
            await _vetAccessService
                .GetAuthorizedDogsAsync(
                    authUserId);

        return View(dogs);
    }

    [HttpGet]
    public async Task<IActionResult> Details(
        Guid id)
    {
        var authUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(
                authUserId))
        {
            return Challenge();
        }

        var model =
            await _vetAccessService
                .GetAuthorizedDogDetailsAsync(
                    authUserId,
                    id);

        if (model == null)
        {
            return Forbid();
        }

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddMedicalRecord(
        Guid dogId,
        string recordType,
        string title,
        string? details,
        DateTime? nextActionDate)
    {
        var authUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(
                authUserId))
        {
            return Challenge();
        }

        var success =
            await _vetAccessService
                .AddMedicalRecordAsync(
                    authUserId,
                    dogId,
                    recordType,
                    title,
                    details,
                    nextActionDate);

        if (!success)
        {
            TempData["ErrorMessage"] =
                "The medical record could not be added.";

            return RedirectToAction(
                nameof(Details),
                new
                {
                    id = dogId
                });
        }

        TempData["SuccessMessage"] =
            "Medical record added.";

        return RedirectToAction(
            nameof(Details),
            new
            {
                id = dogId
            });
    }
}
