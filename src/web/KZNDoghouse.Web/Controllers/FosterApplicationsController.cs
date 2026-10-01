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

    public FosterApplicationsController(
        IFosterApplicationService fosterApplicationService,
        IUserProfileRepository userProfileRepository,
        IDogService dogService)
    {
        _fosterApplicationService = fosterApplicationService;
        _userProfileRepository = userProfileRepository;
        _dogService = dogService;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var applications = await _fosterApplicationService.GetAllAsync();

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
                DogName = dogName
            });
        }

        return View(items);
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

        var result = await _fosterApplicationService.ApproveAsync(id, profile.Id);

        TempData[result.Success ? "SuccessMessage" : "ErrorMessage"] = result.Message;

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