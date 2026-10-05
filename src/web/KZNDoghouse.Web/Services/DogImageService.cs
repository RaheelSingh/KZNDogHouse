using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IDogImageService
{
    Task<IReadOnlyList<DogImage>> GetForDogAsync(Guid dogId);

    Task<DogImageOperationResult> UploadAsync(
        Guid dogId,
        IEnumerable<IFormFile> files,
        Guid createdByProfileId);

    Task<DogImageOperationResult> SetPrimaryAsync(
        Guid dogId,
        Guid imageId);

    Task<DogImageOperationResult> DeleteAsync(
        Guid dogId,
        Guid imageId);
}

public record DogImageOperationResult(
    bool Success,
    string Message,
    int ChangedCount = 0);

public class DogImageService : IDogImageService
{
    private const int MaxImagesPerDog = 10;

    private readonly IDogImageRepository _imageRepository;
    private readonly IDogRepository _dogRepository;
    private readonly IMediaStorageService _mediaStorageService;
    private readonly ILogger<DogImageService> _logger;

    public DogImageService(
        IDogImageRepository imageRepository,
        IDogRepository dogRepository,
        IMediaStorageService mediaStorageService,
        ILogger<DogImageService> logger)
    {
        _imageRepository = imageRepository;
        _dogRepository = dogRepository;
        _mediaStorageService = mediaStorageService;
        _logger = logger;
    }

    public Task<IReadOnlyList<DogImage>> GetForDogAsync(
        Guid dogId) =>
        _imageRepository.GetForDogAsync(dogId);

    public async Task<DogImageOperationResult> UploadAsync(
        Guid dogId,
        IEnumerable<IFormFile> files,
        Guid createdByProfileId)
    {
        var dog = await _dogRepository.GetByIdAsync(dogId);

        if (dog == null)
        {
            return new DogImageOperationResult(
                false,
                "Dog not found.");
        }

        var selectedFiles = files
            .Where(x => x != null && x.Length > 0)
            .ToList();

        if (selectedFiles.Count == 0)
        {
            return new DogImageOperationResult(
                true,
                "No images were selected.");
        }

        var existing =
            (await _imageRepository.GetForDogAsync(dogId))
            .ToList();

        var remaining = MaxImagesPerDog - existing.Count;

        if (remaining <= 0)
        {
            return new DogImageOperationResult(
                false,
                $"A dog can have up to {MaxImagesPerDog} images.");
        }

        var uploadedCount = 0;
        var errors = new List<string>();
        var nextSortOrder = existing.Count == 0
            ? 0
            : existing.Max(x => x.SortOrder) + 1;

        foreach (var file in selectedFiles.Take(remaining))
        {
            var upload =
                await _mediaStorageService.UploadPublicImageAsync(
                    file,
                    StorageFolders.Dogs,
                    dogId);

            if (!upload.Success
                || string.IsNullOrWhiteSpace(upload.StoragePath)
                || string.IsNullOrWhiteSpace(upload.PublicUrl))
            {
                errors.Add(upload.Message);
                continue;
            }

            var isPrimary =
                existing.Count == 0
                && uploadedCount == 0;

            var image = new DogImage
            {
                Id = Guid.NewGuid(),
                DogId = dogId,
                StoragePath = upload.StoragePath,
                PublicUrl = upload.PublicUrl,
                IsPrimary = isPrimary,
                SortOrder = nextSortOrder++,
                AltText = $"Photo of {dog.Name}",
                CreatedBy = createdByProfileId,
                CreatedAt = DateTime.UtcNow
            };

            try
            {
                await _imageRepository.CreateAsync(image);
                uploadedCount++;

                if (isPrimary)
                {
                    dog.PhotoUrl = image.PublicUrl;
                    dog.UpdatedAt = DateTime.UtcNow;
                    await _dogRepository.UpdateAsync(dog);
                }
            }
            catch (Exception ex)
            {
                await _mediaStorageService
                    .DeletePublicImageAsync(image.StoragePath);

                _logger.LogError(
                    ex,
                    "Dog image metadata could not be saved for {DogId}.",
                    dogId);

                errors.Add(
                    $"{file.FileName} could not be saved.");
            }
        }

        if (selectedFiles.Count > remaining)
        {
            errors.Add(
                $"Only {remaining} additional image(s) could be added because the limit is {MaxImagesPerDog}.");
        }

        if (uploadedCount == 0)
        {
            return new DogImageOperationResult(
                false,
                errors.FirstOrDefault()
                ?? "No images were uploaded.");
        }

        var message = uploadedCount == 1
            ? "1 image uploaded."
            : $"{uploadedCount} images uploaded.";

        if (errors.Count > 0)
        {
            message += $" {errors.Count} file(s) were skipped.";
        }

        return new DogImageOperationResult(
            true,
            message,
            uploadedCount);
    }

    public async Task<DogImageOperationResult> SetPrimaryAsync(
        Guid dogId,
        Guid imageId)
    {
        var image = await _imageRepository.GetByIdAsync(imageId);

        if (image == null || image.DogId != dogId)
        {
            return new DogImageOperationResult(
                false,
                "Image not found.");
        }

        var dog = await _dogRepository.GetByIdAsync(dogId);

        if (dog == null)
        {
            return new DogImageOperationResult(
                false,
                "Dog not found.");
        }

        await _imageRepository.SetPrimaryAsync(
            dogId,
            imageId);

        dog.PhotoUrl = image.PublicUrl;
        dog.UpdatedAt = DateTime.UtcNow;
        await _dogRepository.UpdateAsync(dog);

        return new DogImageOperationResult(
            true,
            "Primary image updated.");
    }

    public async Task<DogImageOperationResult> DeleteAsync(
        Guid dogId,
        Guid imageId)
    {
        var image = await _imageRepository.GetByIdAsync(imageId);

        if (image == null || image.DogId != dogId)
        {
            return new DogImageOperationResult(
                false,
                "Image not found.");
        }

        var wasPrimary = image.IsPrimary;

        await _imageRepository.DeleteAsync(imageId);
        await _mediaStorageService
            .DeletePublicImageAsync(image.StoragePath);

        if (wasPrimary)
        {
            var dog = await _dogRepository.GetByIdAsync(dogId);

            if (dog != null)
            {
                var remaining =
                    await _imageRepository.GetForDogAsync(dogId);

                var replacement = remaining.FirstOrDefault();

                if (replacement != null)
                {
                    await _imageRepository.SetPrimaryAsync(
                        dogId,
                        replacement.Id);

                    dog.PhotoUrl = replacement.PublicUrl;
                }
                else
                {
                    dog.PhotoUrl = null;
                }

                dog.UpdatedAt = DateTime.UtcNow;
                await _dogRepository.UpdateAsync(dog);
            }
        }

        return new DogImageOperationResult(
            true,
            "Image removed.",
            1);
    }
}
