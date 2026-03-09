using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<UserInfo> GetUserInfoAsync(string userId)
    {
        AddUser(userId);
        
        var userInfo = _userInfoStorage[userId];
        return Task.FromResult(DeepCopyUserInfo(userInfo));
    }

    public async Task<bool> UpdateUserInfoAsync(string userId, UserInfo userInfo)
    {
        AddUser(userId);
        
        _userInfoStorage[userId] = DeepCopyUserInfo(userInfo);
        return await Task.FromResult(true);
    }
}
