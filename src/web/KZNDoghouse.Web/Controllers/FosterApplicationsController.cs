using System.Security.Claims;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class FosterApplicationsController : Controller
{
    private readonly IFosterApplicationService _fosterApplicationService;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IDogService _dogService;
    private readonly IDogDocumentService _documents;
    private readonly IFosterApplicationRepository _applications;

    public FosterApplicationsController(
        IFosterApplicationService fosterApplicationService,
        IUserProfileRepository userProfileRepository,
        IDogService dogService,
        IDogDocumentService documents,
        IFosterApplicationRepository applications)
    {
        _fosterApplicationService = fosterApplicationService;
        _userProfileRepository = userProfileRepository;
        _dogService = dogService;
        _documents = documents;
        _applications = applications;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var applications = await _fosterApplicationService.GetAllAsync();
        ViewData["AssignableDogs"] = (await _dogService.GetAllDogsAsync())
            .Where(d => d.Status is not ("Fostered" or "Adopted"))
            .OrderBy(d => d.Name).ToList();

        var items = new List<FosterApplicationListItem>();

        foreach (var application in applications)
        {
            var dogName = "No dog assigned";

            if (application.DogId.HasValue)
            {
                var dog = await _dogService.GetDogAsync(application.DogId.Value);
                dogName = dog?.Name ?? "Unknown dog";
            }

            items.Add(new FosterApplicationListItem
            {
                Application = application,
                DogName = dogName,
                Documents = application.DogId.HasValue
                    ? (await _documents.GetForDogAsync(application.DogId.Value))
                        .Where(d => d.FosterApplicationId == application.Id)
                        .ToList()
                    : Array.Empty<DogDocument>()
            });
        }

        return View(items);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AssignDog(Guid id, Guid dogId)
    {
        var application = await _applications.GetByIdAsync(id);
        var dog = await _dogService.GetDogAsync(dogId);
        if (application == null || dog == null || dog.Status is "Fostered" or "Adopted"
            || application.Status is not ("Submitted" or "Under Review"))
        {
            TempData["ErrorMessage"] = "This dog cannot be assigned to this application.";
            return RedirectToAction(nameof(Index));
        }
        await _applications.AssignDogAsync(id, dogId);
        TempData["SuccessMessage"] = "Dog assigned to the foster application.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StartReview(Guid id)
    {
        var profile = await GetCurrentProfileAsync();
        if (profile == null) return Challenge();
        var result = await _fosterApplicationService.StartReviewAsync(id, profile.Id);
        TempData[result.Success ? "SuccessMessage" : "ErrorMessage"] = result.Message;
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Approve(Guid id)
    {
        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        var applications = await _fosterApplicationService.GetAllAsync();
        var application = applications.FirstOrDefault(x => x.Id == id);
        if (application?.DogId == null)
        {
            TempData["ErrorMessage"] = "Choose a dog before confirming a foster placement.";
            return RedirectToAction(nameof(Index));
        }
        var documents = await _documents.GetForDogAsync(application.DogId.Value);
        if (!documents.Any(d => d.FosterApplicationId == id && d.Category == "Foster"))
        {
            TempData["ErrorMessage"] = "Upload the signed foster agreement before confirming the placement.";
            return RedirectToAction(nameof(Index));
        }
        var result = await _fosterApplicationService.ApproveAsync(id, profile.Id);

        TempData[result.Success ? "SuccessMessage" : "ErrorMessage"] = result.Message;

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UploadAgreement(Guid id, IFormFile? file)
    {
        var profile = await GetCurrentProfileAsync();
        if (profile == null) return Challenge();
        var applications = await _fosterApplicationService.GetAllAsync();
        var application = applications.FirstOrDefault(x => x.Id == id);
        if (application?.DogId == null)
        {
            TempData["ErrorMessage"] = "Select a dog for this application before uploading the agreement.";
            return RedirectToAction(nameof(Index));
        }
        var uploaded = await _documents.UploadAsync(application.DogId.Value, null, "Foster", file, profile.Id, id);
        TempData[uploaded.Success ? "SuccessMessage" : "ErrorMessage"] = uploaded.Message;
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Reject(Guid id, string rejectionReason)
    {
        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        var result = await _fosterApplicationService.RejectAsync(id, profile.Id, rejectionReason);

        TempData[result.Success ? "SuccessMessage" : "ErrorMessage"] = result.Message;

        return RedirectToAction(nameof(Index));
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return null;
        }

        return await _userProfileRepository.GetByAuthUserIdAsync(authId);
    }
}