using KZNDoghouse.Web.Constants;
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

// Services/FosterApplicationService.cs — updated constructor and Approve/Reject
public class FosterApplicationService : IFosterApplicationService
{
    private readonly IFosterApplicationRepository _applicationRepository;
    private readonly IFosteringService _fosteringService;
    private readonly INotificationService _notificationService;

    public FosterApplicationService(
        IFosterApplicationRepository applicationRepository,
        IFosteringService fosteringService,
        INotificationService notificationService)
    {
        _applicationRepository = applicationRepository;
        _fosteringService = fosteringService;
        _notificationService = notificationService;
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

        if (application.ApplicantUserId.HasValue)
        {
            await _notificationService.NotifyUserAsync(
                application.ApplicantUserId.Value,
                NotificationCategories.General,
                "Foster application approved",
                "Your foster application has been approved. We'll be in touch with next steps.");
        }

        return new FosterApplicationDecisionResult(true, "Application approved and dog assigned.");
    }

    public async Task<FosterApplicationDecisionResult> RejectAsync(
        Guid applicationId, Guid reviewedByStaffId, string rejectionReason)
    {
        await _applicationRepository.RejectAsync(applicationId, reviewedByStaffId, rejectionReason);

        var application = await _applicationRepository.GetByIdAsync(applicationId);

        if (application?.ApplicantUserId != null)
        {
            await _notificationService.NotifyUserAsync(
                application.ApplicantUserId.Value,
                NotificationCategories.General,
                "Foster application update",
                rejectionReason);
        }

        return new FosterApplicationDecisionResult(true, "Application rejected.");
    }
}