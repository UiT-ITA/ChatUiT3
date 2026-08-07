using System.Security.Claims;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// Model visibility now depends on these roles, so getting this wrong shows every user an
/// empty model picker.
/// </summary>
public class UserRoleResolutionTests
{
    [Fact]
    public void AnAuthenticatedUserWithNoRoleClaims_StillCountsAsUser()
    {
        // A tenant that emits no app-role claims must not leave everyone with no models.
        var roles = Resolve();

        Assert.Equal(new[] { UserRole.User }, roles);
    }

    [Fact]
    public void ClaimedRoles_AreAddedOnTopOfTheBaseline()
    {
        var roles = Resolve("Admin", "Beta");

        Assert.Contains(UserRole.Admin, roles);
        Assert.Contains(UserRole.Beta, roles);
        Assert.Contains(UserRole.User, roles);
    }

    [Fact]
    public void RoleClaims_AreMatchedCaseInsensitively()
    {
        Assert.Contains(UserRole.Super, Resolve("super"));
    }

    [Fact]
    public void UnknownRoleClaims_AreIgnored()
    {
        // An unrelated directory group must never widen access.
        var roles = Resolve("SomeAzureAdGroup", "Beta");

        Assert.Equal(new[] { UserRole.Beta, UserRole.User }.OrderBy(r => r), roles.OrderBy(r => r));
    }

    [Fact]
    public void DuplicateRoleClaims_AreCollapsed()
    {
        var roles = Resolve("Admin", "Admin", "User");

        Assert.Equal(2, roles.Count);
    }

    [Fact]
    public void AnUnauthenticatedPrincipal_GetsNoRoles()
    {
        var service = new UserService(NullLogger<UserService>.Instance);

        Assert.Empty(service.GetUserRoles(new ClaimsPrincipal(new ClaimsIdentity())));
    }

    private static List<UserRole> Resolve(params string[] roleClaims)
    {
        var service = new UserService(NullLogger<UserService>.Instance);
        var identity = new ClaimsIdentity(
            roleClaims.Select(role => new Claim(ClaimTypes.Role, role)),
            authenticationType: "Test");

        return service.GetUserRoles(new ClaimsPrincipal(identity));
    }
}
