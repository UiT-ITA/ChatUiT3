using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    public Task<UserInfo?> GetUserAsync(string userId)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateUserAsync(UserInfo user)
    {
        throw new NotImplementedException();
    }


    public Task<UserInfo> GetUserInfoAsync(string userId)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateUserInfoAsync(string userId, UserInfo userInfo)
    {
        throw new NotImplementedException();
    }
}
