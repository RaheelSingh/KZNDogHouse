namespace KZNDoghouse.Web.Models;

public class DogDetailsViewModel
{
    public Dog Dog { get; set; } = null!;

    public IReadOnlyList<DogMedicalRecord> MedicalRecords { get; set; } =
        Array.Empty<DogMedicalRecord>();

    public IReadOnlyList<DogNote> Notes { get; set; } =
        Array.Empty<DogNote>();

    public IReadOnlyList<FosteringRecord> FosteringHistory { get; set; } =
        Array.Empty<FosteringRecord>();

    public IReadOnlyList<DogImage> Images { get; set; } =
        Array.Empty<DogImage>();
}