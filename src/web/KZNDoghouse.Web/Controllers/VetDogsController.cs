using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(
    Policy = AuthorizationPolicies.VetMedicalAccess)]
public class VetDogsController : Controller
{
    private readonly IVetAccessService _vetAccessService;
    private readonly IDogDocumentService _documents;
    private readonly IMedicalAlertService _medicalAlerts;
    private readonly IUserProfileRepository _users;
    private readonly ILogger<VetDogsController> _logger;

    public VetDogsController(
        IVetAccessService vetAccessService,
        IDogDocumentService documents,
        IMedicalAlertService medicalAlerts,
        IUserProfileRepository users,
        ILogger<VetDogsController> logger)
    {
        _vetAccessService = vetAccessService;
        _documents = documents;
        _medicalAlerts = medicalAlerts;
        _users = users;
        _logger = logger;
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
        DateTime? nextActionDate,
        IFormFile? attachment)
    {
        var authUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(
                authUserId))
        {
            return Challenge();
        }

        var createdRecordId =
            await _vetAccessService
                .AddMedicalRecordAsync(
                    authUserId,
                    dogId,
                    recordType,
                    title,
                    details,
                    nextActionDate);

        if (!createdRecordId.HasValue)
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

        TempData["SuccessMessage"] = "Medical record added.";
        if (attachment != null && attachment.Length > 0)
        {
            var profile = await _users.GetByAuthUserIdAsync(authUserId);
            if (profile != null)
            {
                var result = await _documents.UploadAsync(dogId, createdRecordId, "Medical", attachment, profile.Id);
                if (!result.Success) TempData["ErrorMessage"] = result.Message;
            }
        }
        try
        {
            var dog = await _vetAccessService.GetAuthorizedDogDetailsAsync(authUserId, dogId);
            await _medicalAlerts.NotifyStaffAsync(dog?.Dog.Name ?? "A dog", title);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Medical record saved but staff alerts failed."); }

        return RedirectToAction(
            nameof(Details),
            new
            {
                id = dogId
            });
    }
}
