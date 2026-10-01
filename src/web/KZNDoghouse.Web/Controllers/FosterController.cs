using System.Security.Claims;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("foster")]
public class FosterController : Controller
{
    private readonly IDogService _dogService;
    private readonly ILogger<FosterController> _logger;

    public FosterController(
        IDogService dogService,
        ILogger<FosterController> logger)
    {
        _dogService = dogService;
        _logger = logger;
    }

    [HttpGet("")]
    public IActionResult Index()
    {
        return View();
    }

    [Authorize]
    [HttpGet("apply")]
    public async Task<IActionResult> Apply(Guid? dogId)
    {
        await LoadDogOptionsAsync();

        return View(new FosterApplicationFormViewModel
        {
            FullName = User.Identity?.Name ?? string.Empty,
            Email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
            DogId = dogId
        });
    }

    [Authorize]
    [HttpPost("apply")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Apply(FosterApplicationFormViewModel model)
    {
        if (model.DogId.HasValue
            && !await IsDogAvailableAsync(model.DogId.Value))
        {
            ModelState.AddModelError(
                nameof(model.DogId),
                "This dog is no longer available. Please choose another dog or leave it blank.");
        }

        if (!ModelState.IsValid)
        {
            await LoadDogOptionsAsync();

            return View(model);
        }

        return RedirectToAction(nameof(Submitted));
    }

    [HttpGet("submitted")]
    public IActionResult Submitted()
    {
        return View();
    }

    private async Task LoadDogOptionsAsync()
    {
        try
        {
            ViewData["DogOptions"] = await _dogService.GetPublicDogsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dogs for the foster form could not be loaded.");

            ViewData["DogOptions"] = Array.Empty<PublicDogListItem>();
        }
    }

    private async Task<bool> IsDogAvailableAsync(Guid dogId)
    {
        try
        {
            return await _dogService.GetPublicDogAsync(dogId) != null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dog {DogId} could not be checked for fostering.", dogId);

            return false;
        }
    }
}
