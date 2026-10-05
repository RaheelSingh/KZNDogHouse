namespace KZNDoghouse.Web.Models;

public class VetDogDetailsViewModel
{
    public Dog Dog { get; set; } = null!;

    public IReadOnlyList<DogMedicalRecord> MedicalRecords { get; set; } =
        Array.Empty<DogMedicalRecord>();
}
