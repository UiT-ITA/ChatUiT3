using ChatUitReact.Server.Authentication;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.Mapping;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Logging;

var builder = WebApplication.CreateBuilder(args);


if (builder.Environment.IsDevelopment())
{
    IdentityModelEventSource.ShowPII = true; // Show PII for debugging purposes
}


// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        string[] allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


var authBuilder = builder.Services.AddAuthentication(options =>
{
    // Set the default scheme to JwtBearer
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
});

// Add Microsoft Identity Web API (EntraID) authentication
authBuilder.AddMicrosoftIdentityWebApi(
    jwtBearerOptions => {
        builder.Configuration.GetSection("AzureAd").Bind(jwtBearerOptions);

        // Explicitly set token validation parameters
        jwtBearerOptions.TokenValidationParameters.ValidateIssuer = true;
        jwtBearerOptions.TokenValidationParameters.ValidateAudience = true;
        jwtBearerOptions.TokenValidationParameters.ValidAudience = builder.Configuration["AzureAd:Audience"];

        // Use the Authority from configuration OR construct it properly
        jwtBearerOptions.Authority = builder.Configuration["AzureAd:Authority"] ??
            $"{builder.Configuration["AzureAd:Instance"]}{builder.Configuration["AzureAd:TenantId"]}";

        // Explicitly set token validation parameters for issuer
        jwtBearerOptions.TokenValidationParameters.ValidIssuer = builder.Configuration["AzureAd:Authority"] ??
            $"{builder.Configuration["AzureAd:Instance"]}{builder.Configuration["AzureAd:TenantId"]}/v2.0";

        // Enable metadata-based configuration (vital for key discovery)
        jwtBearerOptions.MetadataAddress = $"{jwtBearerOptions.Authority}/.well-known/openid-configuration";
    },
    microsoftIdentityOptions => {
        builder.Configuration.GetSection("AzureAd").Bind(microsoftIdentityOptions);
    });


// Add API Key authentication as a separate scheme
authBuilder.AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(
    ApiKeyAuthenticationOptions.DefaultScheme,
    options =>
    {
        options.HeaderName = builder.Configuration["ApiKey:HeaderName"] ?? "X-Api-Key";
        options.ValidKeys = builder.Configuration.GetSection("ApiKey:ValidKeys").Get<string[]>() ?? Array.Empty<string>();
    });

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Add authorization policies
builder.Services.AddAuthorization(options =>
{
    // Default policy - requires either valid JWT or API Key
    options.AddPolicy("DefaultAuth", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme, ApiKeyAuthenticationOptions.DefaultScheme);
    });

    // Policy for endpoints that should only allow JWT auth
    options.AddPolicy("JwtOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme);
    });

    // Policy for endpoints that should only allow API key auth
    options.AddPolicy("ApiKeyOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddAuthenticationSchemes(ApiKeyAuthenticationOptions.DefaultScheme);
    });
});

builder.Services.AddSingleton<DummyService>();
builder.Services.AddSingleton<ChatService>();
builder.Services.AddSingleton<UserService>();
builder.Services.AddSingleton<MapperService>();

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

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
