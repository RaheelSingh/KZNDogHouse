using KZNDoghouse.Web.Configuration;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.Configure<SupabaseSettings>(
    builder.Configuration.GetSection(
        SupabaseSettings.SectionName));

builder.Services.AddScoped<
    ISupabaseClientFactory,
    SupabaseClientFactory>();

builder.Services.AddScoped<
    IAuthService,
    AuthService>();

builder.Services.AddScoped<
    IUserProfileRepository,
    UserProfileRepository>();

builder.Services.AddScoped<
    IUserService,
    UserService>();

builder.Services
    .AddAuthentication(
        CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Auth/Login";
        options.AccessDeniedPath = "/Auth/AccessDenied";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(
        AuthorizationPolicies.PortalAccess,
        policy =>
        {
            policy.RequireRole(
                UserRoles.Staff,
                UserRoles.Administrator);
        });
});

builder.Services.AddScoped<IDogRepository, DogRepository>();
builder.Services.AddScoped<IDogService, DogService>();
builder.Services.AddScoped<IDogMedicalRecordRepository, DogMedicalRecordRepository>();
builder.Services.AddScoped<IDogNoteRepository, DogNoteRepository>();
builder.Services.AddScoped<IDogMedicalService, DogMedicalService>();
builder.Services.AddScoped<IFosteringRecordRepository, FosteringRecordRepository>();
builder.Services.AddScoped<IFosteringService, FosteringService>();
builder.Services.AddScoped<IAvailabilitySlotRepository, AvailabilitySlotRepository>();
builder.Services.AddScoped<IAvailabilityService, AvailabilityService>();
builder.Services.AddScoped<ICalendarEventRepository, CalendarEventRepository>();
builder.Services.AddScoped<ICalendarEventService, CalendarEventService>();
builder.Services.AddScoped<IFosterApplicationRepository, FosterApplicationRepository>();
builder.Services.AddScoped<IFosterApplicationService, FosterApplicationService>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<IInventoryService, InventoryService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthentication();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllers();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();