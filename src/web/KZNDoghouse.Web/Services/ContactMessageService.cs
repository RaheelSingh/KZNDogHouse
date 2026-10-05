using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IContactMessageService
{
    Task SubmitAsync(ContactFormViewModel form, Guid? submittedByProfileId);
}

public class ContactMessageService : IContactMessageService
{
    private readonly IContactMessageRepository _repository;

    public ContactMessageService(IContactMessageRepository repository)
    {
        _repository = repository;
    }

    public async Task SubmitAsync(ContactFormViewModel form, Guid? submittedByProfileId)
    {
        if (!string.IsNullOrWhiteSpace(form.Website))
        {
            return;
        }

        var message = new ContactMessage
        {
            Id = Guid.NewGuid(),
            FirstName = form.FirstName.Trim(),
            LastName = form.LastName.Trim(),
            Email = form.Email.Trim(),
            Phone = string.IsNullOrWhiteSpace(form.Phone) ? null : form.Phone.Trim(),
            Topic = form.Topic,
            Message = form.Message.Trim(),
            SubmittedByUserId = submittedByProfileId,
            IsHandled = false,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.CreateAsync(message);
    }
}
