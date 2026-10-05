using KZNDoghouse.Web.Helpers;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IDogService
{
    Task<IReadOnlyList<Dog>> GetAllDogsAsync();

    Task<Dog?> GetDogAsync(Guid dogId);

    Task<Dog> RegisterDogAsync(Dog dog, Guid createdByUserId);

    Task ChangeStatusAsync(Guid dogId, string newStatus);

    Task UpdateDogAsync(Dog dog);

    Task<IReadOnlyList<PublicDogListItem>> GetPublicDogsAsync();

    Task<PublicDogDetails?> GetPublicDogAsync(Guid dogId);
}

public class DogService : IDogService
{
    private readonly IDogRepository _dogRepository;
    private readonly IDogImageRepository _dogImageRepository;

    public DogService(
        IDogRepository dogRepository,
        IDogImageRepository dogImageRepository)
    {
        _dogRepository = dogRepository;
        _dogImageRepository = dogImageRepository;
    }

    public Task<IReadOnlyList<Dog>> GetAllDogsAsync() =>
        _dogRepository.GetAllAsync();

    public Task<Dog?> GetDogAsync(Guid dogId) =>
        _dogRepository.GetByIdAsync(dogId);

    public Task<Dog> RegisterDogAsync(
        Dog dog,
        Guid createdByUserId)
    {
        dog.CreatedBy = createdByUserId;
        dog.CreatedAt = DateTime.UtcNow;

        return _dogRepository.CreateAsync(dog);
    }

    public Task ChangeStatusAsync(
        Guid dogId,
        string newStatus) =>
        _dogRepository.UpdateStatusAsync(
            dogId,
            newStatus);

    public Task UpdateDogAsync(Dog dog) =>
        _dogRepository.UpdateAsync(dog);

    public async Task<IReadOnlyList<PublicDogListItem>> GetPublicDogsAsync()
    {
        var dogTasks = PublicDogStatusHelper.PublicStatuses
            .Select(status =>
                _dogRepository.GetByStatusAsync(status))
            .ToArray();

        var imagesTask =
            _dogImageRepository.GetAllAsync();

        var dogResults = await Task.WhenAll(dogTasks);
        var allImages = await imagesTask;

        var imageLookup = allImages
            .GroupBy(x => x.DogId)
            .ToDictionary(
                x => x.Key,
                x => (IReadOnlyList<string>)x
                    .OrderByDescending(image => image.IsPrimary)
                    .ThenBy(image => image.SortOrder)
                    .ThenBy(image => image.CreatedAt)
                    .Select(image => image.PublicUrl)
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .ToList());

        return dogResults
            .SelectMany(x => x)
            .OrderByDescending(x => x.IntakeDate)
            .ThenBy(x => x.Name)
            .Select(dog =>
                PublicDogListItem.FromDog(
                    dog,
                    imageLookup.GetValueOrDefault(dog.Id)))
            .ToList();
    }

    public async Task<PublicDogDetails?> GetPublicDogAsync(
        Guid dogId)
    {
        var dog = await _dogRepository.GetByIdAsync(dogId);

        if (dog == null
            || !PublicDogStatusHelper.IsPublic(dog.Status))
        {
            return null;
        }

        var images =
            await _dogImageRepository.GetForDogAsync(dogId);

        return PublicDogDetails.FromDog(
            dog,
            images.Select(x => x.PublicUrl).ToList());
    }
}
