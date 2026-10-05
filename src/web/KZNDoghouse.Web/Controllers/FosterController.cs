using System.Security.Claims;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("foster")]
public class FosterController : Controller
{
    private const int NeedFosterDogCount = 4;

    private readonly IDogService _dogService;
    private readonly IFosterApplicationService _fosterApplicationService;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly ILogger<FosterController> _logger;

    public FosterController(
        IDogService dogService,
        IFosterApplicationService fosterApplicationService,
        IUserProfileRepository userProfileRepository,
        ILogger<FosterController> logger)
    {
        _dogService = dogService;
        _fosterApplicationService = fosterApplicationService;
        _userProfileRepository = userProfileRepository;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var model = new FosterPageViewModel();

        try
        {
            var dogs = await _dogService.GetPublicDogsAsync();

            model.NeedFosterDogs = dogs
                .Where(x => !x.IsFostered)
                .Take(NeedFosterDogCount)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dogs needing a foster home could not be loaded.");
        }

        return View(model);
    }

    [Authorize]
    [HttpGet("apply")]
    public async Task<IActionResult> Apply(Guid? dogId)
    {
        await LoadSelectedDogAsync(dogId);

        var fullName = User.Identity?.Name ?? string.Empty;
        var nameParts = fullName.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

        return View(new FosterApplicationFormViewModel
        {
            FirstName = nameParts.Length > 0 ? nameParts[0] : string.Empty,
            LastName = nameParts.Length > 1 ? nameParts[1] : string.Empty,
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
                string.Empty,
                "The dog you chose is no longer available. Please go back and choose another dog, or apply without choosing one.");
        }

        var profile = await GetCurrentProfileAsync();

        if (profile == null || !profile.IsActive)
        {
            ModelState.AddModelError(
                string.Empty,
                "We could not find your account. Please sign out and sign in again.");
        }

        if (!ModelState.IsValid)
        {
            await LoadSelectedDogAsync(model.DogId);

            return View(model);
        }

        FosterApplicationSubmitResult result;

        try
        {
            result = await _fosterApplicationService.SubmitAsync(model, profile!.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "A foster application could not be saved.");

            result = new FosterApplicationSubmitResult(
                false,
                "We could not save your application right now. Please try again in a few minutes.");
        }

        if (!result.Success)
        {
            ModelState.AddModelError(string.Empty, result.Message);

            await LoadSelectedDogAsync(model.DogId);

            return View(model);
        }

        return RedirectToAction(nameof(Submitted));
    }

    [HttpGet("submitted")]
    public IActionResult Submitted()
    {
        return View();
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return null;
        }

        try
        {
            return await _userProfileRepository.GetByAuthUserIdAsync(authId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "The applicant profile could not be loaded.");

            return null;
        }
    }

    private async Task LoadSelectedDogAsync(Guid? dogId)
    {
        try
        {
            if (dogId.HasValue)
            {
                var dog = await _dogService.GetPublicDogAsync(dogId.Value);

                ViewData["SelectedDogName"] = dog?.Name;
                ViewData["SelectedDogPhotoUrl"] = dog?.PhotoUrl;
                ViewData["SelectedDogPhotoName"] = dog?.Name;

                return;
            }

            var dogs = await _dogService.GetPublicDogsAsync();

            var featuredDog = dogs
                .FirstOrDefault(x =>
                    !string.IsNullOrWhiteSpace(x.PhotoUrl));

            ViewData["SelectedDogPhotoUrl"] = featuredDog?.PhotoUrl;
            ViewData["SelectedDogPhotoName"] = featuredDog?.Name;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "A dog image could not be loaded for the foster application form.");
        }
    }

    private async Task<bool> IsDogAvailableAsync(Guid dogId)
    {
        try
        {
            var dog = await _dogService.GetPublicDogAsync(dogId);

            return dog != null && !dog.IsFostered;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dog {DogId} could not be checked for fostering.", dogId);

            return false;
        }
    }
}

