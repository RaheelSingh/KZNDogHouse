namespace KZNDoghouse.Web.Constants;

public static class FosterPeriods
{
    public const string FewWeeks = "A few weeks";
    public const string OneToThreeMonths = "1 to 3 months";
    public const string ThreeMonthsOrLonger = "3 months or longer";
    public const string Flexible = "Flexible";

    public static readonly string[] All =
    [
        FewWeeks, OneToThreeMonths, ThreeMonthsOrLonger, Flexible
    ];
}
