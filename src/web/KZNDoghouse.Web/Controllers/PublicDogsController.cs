using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Route("our-dogs")]
public class PublicDogsController : Controller
{
    private const int MoreDogsCount = 4;

    private readonly IDogService _dogService;
    private readonly ILogger<PublicDogsController> _logger;

    public PublicDogsController(
        IDogService dogService,
        ILogger<PublicDogsController> logger)
    {
        _dogService = dogService;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(
        string? size,
        string? status,
        string? sort,
        int? take)
    {
        var filter = PublicDogFilter.Create(size, status, sort, take);

        try
        {
            var dogs = await _dogService.GetPublicDogsAsync();
            var matches = filter.Apply(dogs);

            var model = new PublicDogListViewModel
            {
                Dogs = matches.Take(filter.Take).ToList(),
                MatchCount = matches.Count,
                OverallCount = dogs.Count,
                Filter = filter
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Public dogs could not be loaded.");

            ViewData["LoadFailed"] = true;

            return View(new PublicDogListViewModel { Filter = filter });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Details(Guid id)
    {
        try
        {
            var dog = await _dogService.GetPublicDogAsync(id);

            if (dog == null)
            {
                Response.StatusCode = StatusCodes.Status404NotFound;

                return View("Unavailable", new PublicMessageViewModel
                {
                    Title = "This dog is not available",
                    Message = "They may have found a home, or the link may be incorrect."
                });
            }

            return View(new PublicDogDetailsViewModel
            {
                Dog = dog,
                MoreDogs = await LoadMoreDogsAsync(id)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Public dog {DogId} could not be loaded.", id);

            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;

            return View("Unavailable", new PublicMessageViewModel
            {
                Title = "We could not load this dog",
                Message = "Please try again in a few minutes."
            });
        }
    }

    private async Task<IReadOnlyList<PublicDogListItem>> LoadMoreDogsAsync(Guid currentDogId)
    {
        try
        {
            var dogs = await _dogService.GetPublicDogsAsync();

            return dogs
                .Where(x => x.Id != currentDogId)
                .Take(MoreDogsCount)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "More dogs could not be loaded for dog {DogId}.", currentDogId);

            return Array.Empty<PublicDogListItem>();
        }
    }
}
