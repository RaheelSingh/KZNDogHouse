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
}

public class DogService : IDogService
{
    private readonly IDogRepository _dogRepository;

    public DogService(IDogRepository dogRepository)
    {
        _dogRepository = dogRepository;
    }

    public Task<IReadOnlyList<Dog>> GetAllDogsAsync() =>
        _dogRepository.GetAllAsync();

    public Task<Dog?> GetDogAsync(Guid dogId) =>
        _dogRepository.GetByIdAsync(dogId);

    public Task<Dog> RegisterDogAsync(Dog dog, Guid createdByUserId)
    {
        dog.Id = Guid.NewGuid();
        dog.CreatedBy = createdByUserId;
        dog.CreatedAt = DateTime.UtcNow;

        return _dogRepository.CreateAsync(dog);
    }

    public Task ChangeStatusAsync(Guid dogId, string newStatus) =>
        _dogRepository.UpdateStatusAsync(dogId, newStatus);

        public Task UpdateDogAsync(Dog dog) =>
    _dogRepository.UpdateAsync(dog);
}




