using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    public async Task<UserInfo?> GetUserAsync(string userId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<UserDocument>(_userContainer!, userId, userId);
        if (document != null)
        {
            return MapUser(document);
        }

        var newUser = new UserInfo
        {
            Username = userId,
            Roles = new List<UserRole>(),
            Preferences = new UserPreferences()
        };

        await UpsertUserAsync(userId, newUser);
        return newUser;
    }

    public async Task<bool> UpdateUserAsync(UserInfo user)
    {
        if (string.IsNullOrWhiteSpace(user.Username))
        {
            return false;
        }

        return await UpsertUserAsync(user.Username, user);
    }


    public async Task<UserInfo> GetUserInfoAsync(string userId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<UserDocument>(_userContainer!, userId, userId);
        if (document != null)
        {
            return MapUser(document);
        }

        var newUser = new UserInfo
        {
            Username = userId,
            Roles = new List<UserRole>(),
            Preferences = new UserPreferences()
        };

        await UpsertUserAsync(userId, newUser);
        return newUser;
    }

    public async Task<bool> UpdateUserInfoAsync(string userId, UserInfo userInfo)
    {
        return await UpsertUserAsync(userId, userInfo);
    }

    private async Task<bool> UpsertUserAsync(string userId, UserInfo userInfo)
    {
        await EnsureInitializedAsync();

        var document = MapUserDocument(userId, userInfo);
        await _userContainer!.UpsertItemAsync(document, new PartitionKey(userId));
        userInfo.Username = userId;
        return true;
    }

    private static UserInfo MapUser(UserDocument document)
    {
        return new UserInfo
        {
            Username = document.UserId,
            Roles = document.Roles,
            Preferences = document.Preferences
        };
    }

    private static UserDocument MapUserDocument(string userId, UserInfo userInfo)
    {
        return new UserDocument
        {
            Id = userId,
            UserId = userId,
            Roles = userInfo.Roles,
            Preferences = userInfo.Preferences
        };
    }
}
