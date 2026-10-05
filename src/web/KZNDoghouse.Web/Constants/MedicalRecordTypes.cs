namespace KZNDoghouse.Web.Constants;

public static class MedicalRecordTypes
{
    public const string Vaccination = "Vaccination";
    public const string Condition = "Condition";
    public const string Medication = "Medication";
    public const string TreatmentNote = "Treatment note";

    public static readonly string[] All =
    [
        Vaccination, Condition, Medication, TreatmentNote
    ];
}

public static class MedicalRecordStatuses
{
    public const string Active = "Active";
    public const string Resolved = "Resolved";

    public static readonly string[] All = [Active, Resolved];
}