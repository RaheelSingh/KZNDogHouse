using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IFosterApplicationService
{
    Task<IReadOnlyList<FosterApplication>> GetAllAsync();

    Task<FosterApplicationDecisionResult> ApproveAsync(Guid applicationId, Guid reviewedByStaffId);

    Task<FosterApplicationDecisionResult> RejectAsync(
        Guid applicationId, Guid reviewedByStaffId, string rejectionReason);
}

public record FosterApplicationDecisionResult(bool Success, string Message);

public class FosterApplicationService : IFosterApplicationService
{
    private readonly IFosterApplicationRepository _applicationRepository;
    private readonly IFosteringService _fosteringService;

    public FosterApplicationService(
        IFosterApplicationRepository applicationRepository,
        IFosteringService fosteringService)
    {
        _applicationRepository = applicationRepository;
        _fosteringService = fosteringService;
    }

    public Task<IReadOnlyList<FosterApplication>> GetAllAsync() =>
        _applicationRepository.GetAllAsync();

    public async Task<FosterApplicationDecisionResult> ApproveAsync(
        Guid applicationId, Guid reviewedByStaffId)
    {
        var application = await _applicationRepository.GetByIdAsync(applicationId);

        if (application == null)
        {
            return new FosterApplicationDecisionResult(false, "Application not found.");
        }

        if (application.DogId == null)
        {
            return new FosterApplicationDecisionResult(
                false,
                "This application has no dog assigned yet — assign a dog before approving.");
        }

        var fosteringRecord = await _fosteringService.StartFosteringAsync(
            application.DogId.Value,
            application.ApplicantUserId,
            application.ApplicantName,
            reviewedByStaffId);

        await _applicationRepository.ApproveAsync(
            applicationId, reviewedByStaffId, fosteringRecord.Id);

        return new FosterApplicationDecisionResult(true, "Application approved and dog assigned.");
    }

    public async Task<FosterApplicationDecisionResult> RejectAsync(
        Guid applicationId, Guid reviewedByStaffId, string rejectionReason)
    {
        await _applicationRepository.RejectAsync(applicationId, reviewedByStaffId, rejectionReason);

        return new FosterApplicationDecisionResult(true, "Application rejected.");
    }
}