using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IVetAccessService
{
    Task<VetAccessViewModel?> GetAdminAccessAsync(
        Guid vetUserProfileId);

    Task<UserAccessUpdateResult> UpdateAuthorizationsAsync(
        Guid vetUserProfileId,
        IReadOnlyCollection<Guid> selectedDogIds,
        string administratorAuthUserId);

    Task<IReadOnlyList<Dog>>
        GetAuthorizedDogsAsync(
            string vetAuthUserId);

    Task<VetDogDetailsViewModel?>
        GetAuthorizedDogDetailsAsync(
            string vetAuthUserId,
            Guid dogId);

    Task<bool> AddMedicalRecordAsync(
        string vetAuthUserId,
        Guid dogId,
        string recordType,
        string title,
        string? details,
        DateTime? nextActionDate);
}

public class VetAccessService : IVetAccessService
{
    private readonly IVetAccessRepository _vetAccessRepository;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IDogRepository _dogRepository;
    private readonly IDogMedicalService _dogMedicalService;

    public VetAccessService(
        IVetAccessRepository vetAccessRepository,
        IUserProfileRepository userProfileRepository,
        IDogRepository dogRepository,
        IDogMedicalService dogMedicalService)
    {
        _vetAccessRepository = vetAccessRepository;
        _userProfileRepository = userProfileRepository;
        _dogRepository = dogRepository;
        _dogMedicalService = dogMedicalService;
    }

    public async Task<VetAccessViewModel?>
        GetAdminAccessAsync(
            Guid vetUserProfileId)
    {
        var vetUser =
            await _userProfileRepository
                .GetByIdAsync(vetUserProfileId);

        if (vetUser == null
            || vetUser.Role != UserRoles.Vet)
        {
            return null;
        }

        var vetProfile =
            await _vetAccessRepository
                .EnsureVetProfileAsync(vetUser.Id);

        var authorizations =
            await _vetAccessRepository
                .GetAuthorizationsAsync(
                    vetProfile.Id);

        var dogs =
            await _dogRepository.GetAllAsync();

        return new VetAccessViewModel
        {
            VetUser = vetUser,
            Dogs = dogs,
            AuthorizedDogIds =
                authorizations
                    .Select(x => x.DogId)
                    .ToHashSet()
        };
    }

    public async Task<UserAccessUpdateResult>
        UpdateAuthorizationsAsync(
            Guid vetUserProfileId,
            IReadOnlyCollection<Guid> selectedDogIds,
            string administratorAuthUserId)
    {
        var administrator =
            await _userProfileRepository
                .GetByAuthUserIdAsync(
                    administratorAuthUserId);

        if (administrator == null
            || administrator.Role !=
                UserRoles.Administrator)
        {
            return new UserAccessUpdateResult(
                false,
                "The administrator account could not be verified.");
        }

        var vetUser =
            await _userProfileRepository
                .GetByIdAsync(vetUserProfileId);

        if (vetUser == null
            || vetUser.Role != UserRoles.Vet
            || !vetUser.IsActive)
        {
            return new UserAccessUpdateResult(
                false,
                "The selected account is not an active Vet account.");
        }

        var allDogs =
            await _dogRepository.GetAllAsync();

        var validDogIds =
            allDogs
                .Select(x => x.Id)
                .ToHashSet();

        var requestedDogIds =
            selectedDogIds
                .Where(validDogIds.Contains)
                .ToHashSet();

        var vetProfile =
            await _vetAccessRepository
                .EnsureVetProfileAsync(vetUser.Id);

        var existing =
            await _vetAccessRepository
                .GetAuthorizationsAsync(
                    vetProfile.Id);

        var existingDogIds =
            existing
                .Select(x => x.DogId)
                .ToHashSet();

        var toAdd =
            requestedDogIds
                .Except(existingDogIds)
                .ToList();

        var toRemove =
            existingDogIds
                .Except(requestedDogIds)
                .ToList();

        foreach (var dogId in toAdd)
        {
            await _vetAccessRepository
                .AddAuthorizationAsync(
                    vetProfile.Id,
                    dogId,
                    administrator.Id);
        }

        foreach (var dogId in toRemove)
        {
            await _vetAccessRepository
                .RemoveAuthorizationAsync(
                    vetProfile.Id,
                    dogId);
        }

        return new UserAccessUpdateResult(
            true,
            $"{vetUser.FullName}'s authorised dogs have been updated.");
    }

    public async Task<IReadOnlyList<Dog>>
        GetAuthorizedDogsAsync(
            string vetAuthUserId)
    {
        var context =
            await GetVetContextAsync(
                vetAuthUserId);

        if (context == null)
        {
            return Array.Empty<Dog>();
        }

        var authorizations =
            await _vetAccessRepository
                .GetAuthorizationsAsync(
                    context.Value.VetProfile.Id);

        var authorizedIds =
            authorizations
                .Select(x => x.DogId)
                .ToHashSet();

        if (authorizedIds.Count == 0)
        {
            return Array.Empty<Dog>();
        }

        var dogs =
            await _dogRepository.GetAllAsync();

        return dogs
            .Where(x =>
                authorizedIds.Contains(x.Id))
            .OrderBy(x => x.Name)
            .ToList();
    }

    public async Task<VetDogDetailsViewModel?>
        GetAuthorizedDogDetailsAsync(
            string vetAuthUserId,
            Guid dogId)
    {
        var context =
            await GetVetContextAsync(
                vetAuthUserId);

        if (context == null)
        {
            return null;
        }

        var isAuthorized =
            await IsAuthorizedAsync(
                context.Value.VetProfile.Id,
                dogId);

        if (!isAuthorized)
        {
            return null;
        }

        var dog =
            await _dogRepository.GetByIdAsync(
                dogId);

        if (dog == null)
        {
            return null;
        }

        return new VetDogDetailsViewModel
        {
            Dog = dog,
            MedicalRecords =
                await _dogMedicalService
                    .GetRecordsAsync(dogId)
        };
    }

    public async Task<bool> AddMedicalRecordAsync(
        string vetAuthUserId,
        Guid dogId,
        string recordType,
        string title,
        string? details,
        DateTime? nextActionDate)
    {
        if (!MedicalRecordTypes.All.Contains(
                recordType)
            || string.IsNullOrWhiteSpace(title))
        {
            return false;
        }

        var context =
            await GetVetContextAsync(
                vetAuthUserId);

        if (context == null)
        {
            return false;
        }

        var isAuthorized =
            await IsAuthorizedAsync(
                context.Value.VetProfile.Id,
                dogId);

        if (!isAuthorized)
        {
            return false;
        }

        await _dogMedicalService.AddRecordAsync(
            dogId,
            recordType,
            title.Trim(),
            string.IsNullOrWhiteSpace(details)
                ? null
                : details.Trim(),
            context.Value.UserProfile.FullName,
            nextActionDate,
            context.Value.UserProfile.Id);

        return true;
    }

    private async Task<(
        UserProfile UserProfile,
        VetProfile VetProfile)?>
        GetVetContextAsync(
            string vetAuthUserId)
    {
        var userProfile =
            await _userProfileRepository
                .GetByAuthUserIdAsync(
                    vetAuthUserId);

        if (userProfile == null
            || !userProfile.IsActive
            || userProfile.Role != UserRoles.Vet)
        {
            return null;
        }

        var vetProfile =
            await _vetAccessRepository
                .EnsureVetProfileAsync(
                    userProfile.Id);

        return (
            userProfile,
            vetProfile);
    }

    private async Task<bool> IsAuthorizedAsync(
        Guid vetProfileId,
        Guid dogId)
    {
        var authorizations =
            await _vetAccessRepository
                .GetAuthorizationsAsync(
                    vetProfileId);

        return authorizations.Any(x =>
            x.DogId == dogId);
    }
}
