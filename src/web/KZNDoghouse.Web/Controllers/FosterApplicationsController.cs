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

    public FosterApplicationsController(
        IFosterApplicationService fosterApplicationService,
        IUserProfileRepository userProfileRepository)
    {
        _fosterApplicationService = fosterApplicationService;
        _userProfileRepository = userProfileRepository;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var applications = await _fosterApplicationService.GetAllAsync();

        return View(applications);
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