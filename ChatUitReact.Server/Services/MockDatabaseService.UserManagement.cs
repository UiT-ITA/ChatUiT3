using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<UserInfo> GetUserInfoAsync(string userId)
    {
        UserInfo userInfo = new ()
        {
            Username = userId,
            Preferences = _userInfo.Preferences,
            Roles = _userInfo.Roles
        };

        return Task.FromResult(userInfo);
    }

    public async Task<bool> UpdateUserInfoAsync(string userId, UserInfo userInfo)
    {
        _userInfo = userInfo;
        return await Task.FromResult(true);
    }
}
