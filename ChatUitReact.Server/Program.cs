using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Logging;

var builder = WebApplication.CreateBuilder(args);

// Enable PII visibility in development for better debugging
if (builder.Environment.IsDevelopment())
{
    IdentityModelEventSource.ShowPII = true;
}

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        string[] allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() 
            ?? new[] { "https://localhost:54979" };
            
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // This is critical for SignalR
    });
});

// Simple authentication setup for Microsoft Entra ID (Azure AD) only
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

// Add authorization with DefaultAuth policy
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("DefaultAuth", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme);
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// IMPORTANT: Configure SignalR properly
builder.Services.AddSignalR(hubOptions => {
    hubOptions.EnableDetailedErrors = true; // Enable detailed errors for debugging
});

// Register services
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ChatNotificationService>();

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "OpenAPI V1");
    });
    app.UseCors("AllowReactApp");
}

app.UseRouting();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chatHub");
app.MapFallbackToFile("/index.html");

app.Run();